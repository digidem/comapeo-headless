import * as mlef from '@mapeo/legacy-export-format'
import pProps from 'p-props'
import * as v from 'valibot'
import { temporaryWrite } from 'tempy'
/** @import { MapeoManager } from '@comapeo/core' */
/** @import { MapeoProject } from '@comapeo/core/dist/mapeo-project.js' */
/** @import { ObservationValue } from '@comapeo/schema' */

/**
 * @internal
 * @typedef {object} OldAttachment
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

// Lifted from <https://github.com/digidem/mapeo-mobile/blob/0c0ebbb9ef2261e21cd1d1c8bd5ab2fe42017ea3/src/frontend/%40types/mapeo-schema.d.ts#L41-L70>.
// TODO: Remove keys we dont use
const OldDocumentSchema = v.object({
  attachments: v.optional(
    v.array(
      v.object({
        id: v.string(),
        type: v.optional(v.string()),
      }),
    ),
  ),
  created_at: v.string(),
  deviceId: v.optional(v.string()),
  id: v.string(),
  lat: v.nullish(v.number()),
  links: v.optional(v.array(v.string())),
  lon: v.nullish(v.number()),
  metadata: v.optional(
    v.object({
      location: v.optional(
        v.object({
          error: v.boolean(),
          permission: v.union([
            v.literal('granted'),
            v.literal('denied'),
            v.literal('never_ask_again'),
          ]),
          position: v.optional(OldPositionSchema),
          provider: v.optional(OldProviderSchema),
        }),
      ),
      manualLocation: v.optional(v.boolean()),
    }),
  ),
  refs: v.optional(
    v.array(
      v.object({
        id: v.string(),
      }),
    ),
  ),
  schemaVersion: v.literal(3),
  tags: v.optional(OldTagsSchema),
  timestamp: v.optional(v.string()),
  type: v.literal('observation'),
  userId: v.optional(v.string()),
  // TODO
  // version: v.string(),
})

/**
 * @param {Awaited<ReturnType<typeof mlef.reader>>} reader
 * @param {TODO} rawOldDocument
 * @returns {Promise<null | { attachments: OldAttachment[], value: ObservationValue }>}
 */
async function parseOldObservation(reader, rawOldDocument) {
  // TODO: attach hypercore metadata to metadata

  const parsed = v.safeParse(OldDocumentSchema, rawOldDocument)
  if (!parsed.success) {
    console.log(parsed.issues)
    return null
  }
  const oldDocument = parsed.output

  // TODO: add more values
  /** @type {ObservationValue} */
  const value = {
    schemaName: 'observation',
    attachments: [],
    tags: oldDocument.tags || {},
  }

  const attachments = await Promise.all(
    (oldDocument.attachments || []).map(async (attachment) => {
      /** @type {OldAttachment} */
      const result = { type: attachment.type || 'image/jpeg', variants: {} }
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

  const originalData = oldAttachment.variants.original
  if (!originalData) return null

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

  // TODO: Clean up temporary files

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

  for await (const document of reader.documents()) {
    // TODO: Updates
    const [firstVersion] = document.versions
    if (!firstVersion) {
      debug(`Skipping import of ${document.id} because it has no versions.`)
      continue
    }

    const parsedOldObservation = await parseOldObservation(reader, firstVersion)
    if (!parsedOldObservation) {
      debug(`Skipping import of ${document.id} because we couldn't parse it.`)
      continue
    }

    const { attachments, value } = parsedOldObservation
    const newAttachments = (
      await Promise.all(
        attachments.map(async (oldAttachment) =>
          createAttachment({ project, oldAttachment }),
        ),
      )
    ).filter((v) => v !== null)

    const observation = await project.observation.create({
      ...value,
      attachments: newAttachments,
    })
    debug(
      `Imported ${document.id} into new observation at ${observation.docId}.`,
    )
  }
}
