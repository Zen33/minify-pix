const { resolve, extname } = require('path')
const fs = require('fs')
const ora = require('ora')
const chalk = require('chalk')
const simpleGit = require('simple-git')
const { fdir } = require('fdir')
const minimist = require('minimist')
const MinifyPix = require('./base')

const DEFAULT_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.svg']
const IMAGE_TYPES_REGEX = /\.(jpe?g|png|gif|svg)$/i
const CONFIG_FILE = 'minifyPix.config.js'

class Service {
  constructor(config) {
    const pkgJson = require(resolve(__dirname, 'package.json'))
    const rootPkg = config || require(resolve(process.cwd(), 'package.json'))
    const configFile = resolve(process.cwd(), CONFIG_FILE)

    this.config = fs.existsSync(configFile) ? require(configFile) : rootPkg.minifyPix || {}
    this.version = pkgJson?.version
    this.imageTypes = this.getImageTypes(this.config.imageTypes)
    this.minifyPix = new MinifyPix(this.config)
    this.spinner = ora('Optimizing images...').start()
  }

  filterImageFiles(files = []) {
    return files?.filter(file => IMAGE_TYPES_REGEX.test(extname(file)))
  }

  getImageTypes(types) {
    if (!Array.isArray(types)) {
      return DEFAULT_IMAGE_TYPES
    }

    return types.every(type => DEFAULT_IMAGE_TYPES.includes(type)) ? types : DEFAULT_IMAGE_TYPES
  }

  async getUnstagedChanges() {
    const git = simpleGit()
    const status = await git.status()
    const isStaged = this.config.status === 'staged'

    return status.files
      .filter(file => (isStaged ? file.index === 'A' : file.index !== 'r') && file.working_dir !== 'D' && file.index !== 'D')
      .map(file => resolve(file.path))
  }

  async optimizeFilesFromDirectory(directory, excludePatterns = ['node_modules']) {
    const files = await new fdir()
      .withFullPaths()
      .exclude(dir => excludePatterns.some(pattern => dir.includes(pattern)))
      .crawl(directory)
      .withPromise()

    return files
  }

  async start(config) {
    let unstagedChanges = []
    let successCount = 0
    let totalSaving = 0
    const failedFiles = []
    const args = minimist(process.argv.slice(2))

    if (args.version) {
      this.spinner.info(this.version)
      this.spinner.stop()
      return
    }

    config = config || this.config || {}
    if (config.destination) {
      unstagedChanges = await this.optimizeFilesFromDirectory(config.destination, config.exclude)
    } else {
      unstagedChanges = await this.getUnstagedChanges()
      if (!unstagedChanges?.length) {
        this.spinner.info('No unstaged changes found')
        return
      }
    }

    const imageFiles = this.filterImageFiles(unstagedChanges)

    if (!imageFiles?.length) {
      this.spinner.info('No matched image files found')
      return
    }

    const optimizeFile = async (file) => {
      try {
        const optimizedFile = await this.minifyPix.optimize(file)

        successCount++
        totalSaving += optimizedFile.saving
        this.spinner.succeed(
          `${chalk.green(optimizedFile.filePath)}: ${chalk.yellow(optimizedFile.originalSize)}B -> ${chalk.yellow(
            optimizedFile.optimizedSize
          )}B, saved ${chalk.cyan(optimizedFile.saving)}B (${optimizedFile.savingPercent})`
        )
      } catch (err) {
        const message = err?.message ? `${file}\n${chalk.gray(err.message)}` : file

        failedFiles.push(message)
      }
    }

    await Promise.allSettled(imageFiles.map(optimizeFile))

    if (successCount === 0) {
      this.spinner.stop()
    }

    if (failedFiles.length > 0) {
      console.log(chalk.yellow(`\nSkipped ${failedFiles.length} files due to errors:`))
      failedFiles.forEach(file => console.log(`- ${chalk.red(file)}`))
    }

    console.log(`${chalk.bgGreen.black(' DONE ')} Optimization summary: ${chalk.yellow(successCount)} files optimized, total saving ${chalk.yellow(totalSaving)}B`)
    successCount && this.spinner.stop()
  }
}

module.exports = Service
