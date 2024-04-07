const { constants } = require('fs')
const {
  stat,
  unlink,
  rename,
  copyFile,
  access,
  readFile,
  mkdtemp,
  writeFile,
  rmdir
} = require('fs').promises
const {
  resolve,
  join,
  basename,
  dirname,
  extname
} = require('path')
const { tmpdir } = require('os')
const imagemin = require('imagemin')
const imageminMozjpeg = require('imagemin-mozjpeg')
const imageminPngquant = require('imagemin-pngquant')
const imageminGifsicle = require('imagemin-gifsicle')
const imageminSvgo = require('imagemin-svgo')

const DEFAULT_PLUGIN_CONFIG = {
  jpg: { quality: 90, progressive: true, arithmetic: false },
  png: { quality: [0.8, 0.9], speed: 1 },
  gif: { optimizationLevel: 2, interlaced: false, colors: 256 }
}
const LABEL = '-minify-pix-'

class MinifyPix {
  constructor(config) {
    this.config = config || {}
  }

  getOptions(options) {
    const plugins = {}

    for (const [type, defaultConfig] of Object.entries(DEFAULT_PLUGIN_CONFIG)) {
      const userConfig = options?.[type] || {}

      plugins[type] = { ...defaultConfig, ...userConfig }
    }

    return [
      imageminMozjpeg(plugins.jpg),
      imageminPngquant(plugins.png),
      imageminGifsicle(plugins.gif),
      imageminSvgo()
    ]
  }

  async optimize(filePath) {
    try {
      let optimizedSize
      const isAllowed = await this.checkFilePermissions(filePath, constants.R_OK | constants.W_OK)

      if (!isAllowed) {
        await this.setTempFile(filePath)
      }

      const tmpPath = await this.copyFile(filePath)
      const { size: originalSize } = await stat(filePath)
      const { size: targetSize } = await this.minify(tmpPath, tmpPath)

      if (targetSize < originalSize) {
        await unlink(filePath)
        await rename(tmpPath, filePath)
        optimizedSize = targetSize
      } else {
        await unlink(tmpPath)
        optimizedSize = originalSize
      }

      if (this.config?.target) {
        const targetPath = resolve(process.cwd(), this.config.target)
        const targetFilePath = join(targetPath, basename(filePath))

        await copyFile(filePath, targetFilePath)
      }

      return {
        filePath,
        originalSize,
        optimizedSize,
        saving: originalSize - optimizedSize,
        savingPercent: `${(((originalSize - optimizedSize) / originalSize) * 100).toFixed(2)}%`
      }
    } catch (err) {
      throw new Error(`Failed to optimize ${filePath}: ${err.message}`)
    }
  }

  async minify(src, dest) {
    const plugins = this.getOptions(this.config)

    await imagemin([src], { destination: dirname(dest), plugins })
    return await stat(dest)
  }

  async checkFilePermissions(filePath, mode) {
    try {
      await access(filePath, mode)
      return true
    } catch (err) {
      return false
    }
  }

  async setTempFile(filePath) {
    const imageData = await readFile(filePath)
    const tmpDir = await mkdtemp(join(tmpdir(), LABEL))
    const tmpFilePath = join(tmpDir, basename(filePath))

    try {
      await writeFile(tmpFilePath, imageData)
      await unlink(filePath)
      await rename(tmpFilePath, filePath)
    } catch (error) {
      await unlink(tmpFilePath)
      throw error
    } finally {
      await rmdir(tmpDir)
    }
  }

  async copyFile(filePath) {
    const ext = extname(filePath)
    const newFilePath = join(dirname(filePath), `${basename(filePath, ext)}${LABEL}${ext}`)

    await copyFile(filePath, newFilePath)

    return newFilePath
  }
}

module.exports = MinifyPix
