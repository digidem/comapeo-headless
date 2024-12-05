import * as mlef from '@mapeo/legacy-export-format'
import * as fs from 'node:fs/promises'
import pProps from 'p-props'
import { temporaryWrite } from 'tempy'
import * as v from 'valibot'
import { removeNilValues } from '../lib/removeNilValues.js'
/** @import { MapeoManager } from '@comapeo/core' */
/** @import { MapeoProject } from '@comapeo/core/dist/mapeo-project.js' */
/** @import { Observation, ObservationValue } from '@comapeo/schema' */

/**
 * @internal
 * @typedef {object} OldAttachment
 * @prop {string} id
 * @prop {string} type
 * @prop {Record<string, Uint8Array>} variants
 */

const OldPositionSchema = v.object({
  coords: v.object({
    latitude: v.number(),
    longitude: v.number(),
    altitude: v.nullable(v.number()),
    accuracy: v.nullable(v.number()),
    altitudeAccuracy: v.nullable(v.number()),
    heading: v.nullable(v.number()),
    speed: v.nullable(v.number()),
  }),
  timestamp: v.number(),
})

const OldProviderSchema = v.object({
  backgroundModeEnabled: v.boolean(),
  gpsAvailable: v.optional(v.boolean()),
  passiveAvailable: v.optional(v.boolean()),
  locationServicesEnabled: v.boolean(),
  networkAvailable: v.optional(v.boolean()),
})

const OldTagsSchema = v.record(
  v.string(),
  v.union([
    v.boolean(),
    v.number(),
    v.string(),
    v.null(),
    v.array(v.union([v.boolean(), v.number(), v.string(), v.null()])),
  ]),
)

// Lifted from <https://github.com/digidem/mapeo-mobile/blob/0c0ebbb9ef2261e21cd1d1c8bd5ab2fe42017ea3/src/frontend/%40types/mapeo-schema.d.ts#L41-L70>
// with unnecessary fields removed.
const OldDocumentSchema = v.object({
  attachments: v.optional(
    v.array(
      v.object({
        id: v.string(),
        type: v.optional(v.string()),
      }),
    ),
  ),
  lat: v.nullish(v.number()),
  lon: v.nullish(v.number()),
  metadata: v.optional(
    v.object({
      location: v.optional(
        v.object({
          position: v.optional(OldPositionSchema),
          provider: v.optional(OldProviderSchema),
        }),
      ),
      manualLocation: v.optional(v.boolean()),
    }),
  ),
  schemaVersion: v.literal(3),
  tags: v.optional(OldTagsSchema),
  type: v.literal('observation'),
})

/**
 * @param {Awaited<ReturnType<typeof mlef.reader>>} reader
 * @param {unknown} oldDocument
 * @returns {Promise<null | { attachments: OldAttachment[], value: ObservationValue }>}
 */
async function parseOldObservation(reader, oldDocument) {
  if (!v.is(OldDocumentSchema, oldDocument)) return null

  const oldMetadataLocation = oldDocument.metadata?.location
  const oldMetadataPosition = oldMetadataLocation?.position
  const oldMetadataProvider = oldMetadataLocation?.provider

  /** @type {NonNullable<ObservationValue['metadata']>} */
  const metadata = {
    manualLocation: oldDocument.metadata?.manualLocation,
    position: oldMetadataPosition
      ? {
          timestamp: new Date(oldMetadataPosition.timestamp).toISOString(),
          coords: removeNilValues(oldMetadataPosition.coords),
        }
      : undefined,
    positionProvider: oldMetadataProvider,
  }
  const hasAnyMetadata = Object.values(metadata).some((value) => value != null)

  /** @type {ObservationValue} */
  const value = {
    schemaName: 'observation',
    attachments: [],
    tags: oldDocument.tags || {},
    lat: oldDocument.lat ?? undefined,
    lon: oldDocument.lon ?? undefined,
    metadata: hasAnyMetadata ? metadata : undefined,
  }

  const attachments = await Promise.all(
    (oldDocument.attachments || []).map(async (attachment) => {
      /** @type {OldAttachment} */
      const result = {
        id: attachment.id,
        type: attachment.type || 'image/jpeg',
        variants: {},
      }
      for await (const media of reader.getMediaById(attachment.id)) {
        result.variants[media.variant] = media.data
      }
      return result
    }),
  )

  return { attachments, value }
}

/**
 * @param {object} options
 * @param {MapeoProject} options.project
 * @param {OldAttachment} options.oldAttachment
 * @returns {Promise<null | ObservationValue['attachments'][0]>}
 */
async function createAttachment({ project, oldAttachment }) {
  const originalData = oldAttachment.variants.original
  if (!originalData) return null

  /** @type {string[]} */
  const pathsToCleanUp = []

  /**
   * @param {Uint8Array} data
   * @returns {Promise<string>}
   */
  const writeToTemporaryFile = async (data) => {
    const result = await temporaryWrite(data)
    pathsToCleanUp.push(result)
    return result
  }

  const result = await project.$blobs.create(
    await pProps({
      original: writeToTemporaryFile(originalData),
      preview:
        oldAttachment.variants.preview &&
        writeToTemporaryFile(oldAttachment.variants.preview),
      thumbnail:
        oldAttachment.variants.thumbnail &&
        writeToTemporaryFile(oldAttachment.variants.thumbnail),
    }),
    {
      mimeType: oldAttachment.type,
      timestamp: Date.now(),
    },
  )

  await Promise.all(
    pathsToCleanUp.map((path) => fs.rm(path, { maxRetries: 2 })),
  )

  return {
    driveDiscoveryId: result.driveId,
    ...result,
  }
}

/**
 * @param {object} options
 * @param {MapeoManager} options.mapeoManager
 * @param {string} options.projectId
 * @param {string} options.mlefPath
 * @param {(message: string) => unknown} options.debug
 * @returns {Promise<void>}
 */
export async function importLegacyMapeoData({
  mapeoManager,
  projectId,
  mlefPath,
  debug,
}) {
  const project = await mapeoManager.getProject(projectId)
  debug(`Loaded project ${projectId}.`)

  const reader = await mlef.reader(mlefPath)
  debug(`Started reading ${mlefPath}.`)

  /** @type {Map<string, ObservationValue['attachments'][0]>} */
  const attachmentsCreated = new Map()

  for await (const document of reader.documents()) {
    /** @type {undefined | string} */
    let previousVersionId

    for (const documentVersion of document.versions) {
      const parsedOldObservation = await parseOldObservation(
        reader,
        documentVersion.document,
      )

      if (!parsedOldObservation) {
        debug(
          `Skipping import of ${document.id} version ${documentVersion.version} because we couldn't parse it.`,
        )
        continue
      }

      const { attachments, value } = parsedOldObservation

      /** @type {ObservationValue['attachments']} */
      const newAttachments = []
      await Promise.all(
        attachments.map(async (oldAttachment) => {
          const existingAttachment = attachmentsCreated.get(oldAttachment.id)
          if (existingAttachment) return existingAttachment
          const attachment = await createAttachment({ project, oldAttachment })
          if (attachment) {
            newAttachments.push(attachment)
            attachmentsCreated.set(oldAttachment.id, attachment)
          }
          return attachment
        }),
      )
      debug(
        `Created ${newAttachments.length} attachment(s) for ${document.id}.`,
      )

      const toCreateOrUpdate = { ...value, attachments: newAttachments }

      /** @type {Observation} */
      let observation
      if (previousVersionId) {
        observation = await project.observation.update(
          previousVersionId,
          toCreateOrUpdate,
        )
        debug(
          `Updated ${observation.docId} by importing legacy version ${documentVersion.version}.`,
        )
      } else {
        observation = await project.observation.create(toCreateOrUpdate)
        debug(
          `Created ${observation.docId} from legacy document ${document.id}.`,
        )
      }

      previousVersionId = observation.versionId
    }
  }
}
