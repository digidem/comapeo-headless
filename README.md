# CoMapeo Headless

A headless command line CoMapeo instance.

## Starting the instance

To start the instance on the local network:

```sh
comapeo-headless start --name 'My Headless CoMapeo'
# Or, if run from within this repo:
npm start -- start --name 'My Headless CoMapeo'
```

This will automatically accept all invites and enable sync for all projects.

Press Ctrl-C, or send a `SIGINT`, to stop the server.

This will log when other devices are found. If no devices are found, try restarting.

## List projects

To list all the projects:

```sh
comapeo-headless list-projects
# Or, if run from within this repo:
npm start -- list-projects
```

This will print a result like this:

```
abc123 Project A
xyz987 Project B
```

## Import legacy Mapeo data

To import data from legacy Mapeo, you'll need a Mapeo Legacy Export (`.mlef`) file. Once you have it:

```sh
comapeo-headless import-legacy-mapeo-data \
  --project-id abc123 \
  --mlef-path /path/to/legacy-data.mlef
```

This will import the data into the provided project.

Once this is done, you probably want to run `comapeo-headless start` to sync this data to other devices.
