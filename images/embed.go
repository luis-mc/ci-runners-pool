// Package images holds the image files of the Linux container backend inside
// the crsp binary (runners R5.27, R5.33). No installer ships the images/
// folder, so the agent writes these files to a build folder before a build.
// Only text files are here: Dockerfiles and their scripts.
package images

import "embed"

// FS holds the base image (linux-base), the layers (layers) and the files of the
// persistent Linux pool container (persistent, runners R5.93). Its paths are
// relative to the images/ folder of the repository.
//
//go:embed linux-base layers persistent
var FS embed.FS
