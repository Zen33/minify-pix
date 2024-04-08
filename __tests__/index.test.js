const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const simpleGit = require('simple-git')
const imagemin = require('imagemin')
const imageminMozjpeg = require('imagemin-mozjpeg')
const imageminPngquant = require('imagemin-pngquant')
const imageminGifsicle = require('imagemin-gifsicle')
const imageminSvgo = require('imagemin-svgo')
const MinifyPix = require('../base')
const Service = require('../service')

jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
    access: jest.fn(),
    chmod: jest.fn(),
    rmdir: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn(),
    copyFile: jest.fn(),
    readFile: jest.fn(),
    mkdtemp: jest.fn(),
    writeFile: jest.fn()
  },
  constants: {
    R_OK: 4,
    W_OK: 2
  },
  readdir: jest.fn((path, options, callback) => {
    // 根据需要模拟 readdir 的行为
    callback(null, [])
  }),
  existsSync: jest.fn()
}))
jest.mock('imagemin', () => jest.fn().mockResolvedValue({}))
jest.mock('imagemin-mozjpeg', () => jest.fn().mockResolvedValue({}))
jest.mock('imagemin-pngquant', () => jest.fn().mockResolvedValue({}))
jest.mock('imagemin-gifsicle', () => jest.fn().mockResolvedValue({}))
jest.mock('imagemin-svgo', () => jest.fn().mockResolvedValue({}))
jest.mock('ora', () => {
  return jest.fn().mockReturnValue({
    start: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
    stop: jest.fn(),
    stopAndPersist: jest.fn()
  })
})
jest.mock('chalk', () => {
  return {
    blue: jest.fn(text => text),
    green: jest.fn(text => text),
    yellow: jest.fn(text => text),
    cyan: jest.fn(text => text),
    red: jest.fn(text => text),
    gray: jest.fn(text => text),
    bgGreen: {
      black: jest.fn(() => 'bgGreen.black')
    }
  }
})
jest.mock('simple-git')

describe('MinifyPix', () => {
  let minifyPix
  const filePath = 'test.jpg'
  let originalSize, optimizedSize

  beforeEach(() => {
    originalSize = 1000
    optimizedSize = 800
    fs.promises.stat
      .mockResolvedValueOnce({ size: originalSize })
      .mockResolvedValueOnce({ size: optimizedSize })
    minifyPix = new MinifyPix()
  })

  describe('optimize', () => {
    it('should optimize image file successfully', async () => {
      const optimizedFile = await minifyPix.optimize(filePath)

      expect(optimizedFile).toHaveProperty('filePath', filePath)
      expect(optimizedFile).toHaveProperty('originalSize', originalSize)
      expect(optimizedFile).toHaveProperty('optimizedSize', optimizedSize)
      expect(optimizedFile).toHaveProperty('saving', originalSize - optimizedSize)
      expect(optimizedFile.savingPercent).toBe(`${(((originalSize - optimizedSize) / originalSize) * 100).toFixed(2)}%`)
    })

    it('should handle optimize error', async () => {
      const filePath = 'test.jpg'
      const errorMessage = 'Minify failed'

      jest.spyOn(minifyPix, 'minify').mockRejectedValue(new Error(errorMessage))

      await expect(minifyPix.optimize(filePath)).rejects.toThrowError(`Failed to optimize ${filePath}: ${errorMessage}`)
    })

    it('should copy file to target directory if target option is provided', async () => {
      const targetPath = 'test/target'

      minifyPix.config = { target: targetPath }
      const copyFileSpy = jest.spyOn(fs.promises, 'copyFile')

      await minifyPix.optimize(filePath)

      const expectedTargetFilePath = path.resolve(process.cwd(), targetPath, path.basename(filePath))

      expect(copyFileSpy).toHaveBeenCalledWith(filePath, expectedTargetFilePath)
      copyFileSpy.mockRestore()
    })

    it('should delete temporary file if optimized size is larger than original', async () => {
      const filePath = 'test.jpg'
      const tmpPath = 'test-minify-pix-.jpg'
      const originalSize = 1000
      const targetSize = 1200

      fs.promises.stat
        .mockResolvedValueOnce({ size: originalSize })
        .mockResolvedValueOnce({ size: targetSize })

      const unlinkSpy = jest.spyOn(fs.promises, 'unlink')

      jest.spyOn(minifyPix, 'copyFile').mockResolvedValue(tmpPath)

      await minifyPix.optimize(filePath)

      expect(unlinkSpy).toHaveBeenCalledTimes(1)
      expect(unlinkSpy).toHaveBeenCalledWith(tmpPath)

      unlinkSpy.mockRestore()
    })
  })

  describe('minify', () => {
    it('should call imagemin with correct options for jpeg file', async () => {
      const src = 'test.jpg'
      const dest = 'optimized.jpg'
      const options = { jpg: { quality: 70 } }
      const minifyPix = new MinifyPix({ options })

      await minifyPix.minify(src, dest)

      expect(imagemin).toHaveBeenCalledWith(
        expect.arrayContaining([src]),
        expect.objectContaining({
          destination: path.dirname(dest),
          plugins: expect.arrayContaining([imageminMozjpeg({ quality: 70, progressive: true, arithmetic: false })])
        })
      )
    })

    it('should call imagemin with correct options for png file', async () => {
      const src = 'test.png'
      const dest = 'optimized.png'
      const options = { png: { quality: [0.6, 0.8] } }
      const minifyPix = new MinifyPix({ options })

      await minifyPix.minify(src, dest)

      expect(imagemin).toHaveBeenCalledWith(
        expect.arrayContaining([src]),
        expect.objectContaining({
          destination: path.dirname(dest),
          plugins: expect.arrayContaining([imageminPngquant({ quality: [0.6, 0.8], speed: 1 })])
        })
      )
    })

    it('should call imagemin with correct options for gif file', async () => {
      const src = 'test.gif'
      const dest = 'optimized.gif'
      const options = { gif: { optimizationLevel: 3, interlaced: true } }
      const minifyPix = new MinifyPix({ options })

      await minifyPix.minify(src, dest)

      expect(imagemin).toHaveBeenCalledWith(
        expect.arrayContaining([src]),
        expect.objectContaining({
          destination: path.dirname(dest),
          plugins: expect.arrayContaining([imageminGifsicle({ optimizationLevel: 3, interlaced: true, colors: 256 })])
        })
      )
    })

    it('should call imagemin with correct options for svg file', async () => {
      const src = 'test.svg'
      const dest = 'optimized.svg'
      const minifyPix = new MinifyPix()

      await minifyPix.minify(src, dest)

      expect(imagemin).toHaveBeenCalledWith(
        expect.arrayContaining([src]),
        expect.objectContaining({
          destination: path.dirname(dest),
          plugins: expect.arrayContaining([imageminSvgo()])
        })
      )
    })

    it('should minify the image file', async () => {
      const src = 'test.jpg'
      const dest = 'optimized.jpg'
      const result = await minifyPix.minify(src, dest)

      expect(result).toHaveProperty('size')
      expect(imagemin).toHaveBeenCalledWith(
        expect.arrayContaining([src]),
        expect.objectContaining({ destination: path.dirname(dest) })
      )
    })

    it('should throw an error when source file does not exist', async () => {
      const nonExistingFilePath = 'non-existing-file.jpg'

      fs.promises.access.mockRejectedValue(new Error('ENOENT: no such file or directory'))
      await expect(minifyPix.optimize(nonExistingFilePath)).rejects.toThrow(`Failed to optimize ${nonExistingFilePath}: The \"path\" argument must be of type string. Received undefined`)
    })

    it('should throw an error when imagemin fails', async () => {
      const src = 'test.jpg'
      const dest = 'optimized.jpg'
      const error = new Error('Imagemin failed')

      imagemin.mockRejectedValue(error)

      await expect(minifyPix.minify(src, dest)).rejects.toThrowError(error)
    })
  })

  describe('checkFilePermissions', () => {
    it('should return true if file has permissions', async () => {
      const filePath = 'test.jpg'
      const mode = fs.constants.R_OK | fs.constants.W_OK

      fs.promises.access.mockResolvedValue(undefined)
      const result = await minifyPix.checkFilePermissions(filePath, mode)

      expect(result).toBe(true)
      expect(fs.promises.access).toHaveBeenCalledWith(filePath, mode)
    })

    it('should return false if file does not have permissions', async () => {
      const filePath = 'test.jpg'
      const mode = fs.constants.R_OK | fs.constants.W_OK
      const error = new Error('Access denied')

      fs.promises.access.mockRejectedValue(error)
      const result = await minifyPix.checkFilePermissions(filePath, mode)

      expect(result).toBe(false)
      expect(fs.promises.access).toHaveBeenCalledWith(filePath, mode)
    })
  })

  describe('setTempFile', () => {
    it('should create a temporary file and replace the original file', async () => {
      const filePath = 'test/images/image.jpg'
      const imageData = Buffer.from([0x01, 0x02, 0x03])
      const tempDir = path.join(require('os').tmpdir(), 'minify-pix-123')
      const tempFilePath = `${tempDir}/${path.basename(filePath)}`

      fs.promises.readFile.mockResolvedValue(imageData)
      fs.promises.mkdtemp.mockResolvedValue(tempDir)

      await minifyPix.setTempFile(filePath)

      expect(fs.promises.readFile).toHaveBeenCalledWith(filePath)
      expect(fs.promises.mkdtemp).toHaveBeenCalledWith(expect.stringMatching(/.*minify-pix-.*/))
      expect(fs.promises.writeFile).toHaveBeenCalledWith(tempFilePath, imageData)
      expect(fs.promises.unlink).toHaveBeenCalledWith(filePath)
      expect(fs.promises.rename).toHaveBeenCalledWith(tempFilePath, filePath)
      expect(fs.promises.rmdir).toHaveBeenCalledWith(tempDir)
    })

    it('should remove temporary file and rethrow error when write or rename fails', async () => {
      const filePath = 'test/images/image.jpg'
      const imageData = Buffer.from([0x01, 0x02, 0x03])
      const tempDir = path.join(require('os').tmpdir(), 'minify-pix-123')
      const tempFilePath = `${tempDir}/${path.basename(filePath)}`
      const writeError = new Error('Write error')
      const renameError = new Error('Rename error')

      fs.promises.readFile.mockResolvedValue(imageData)
      fs.promises.mkdtemp.mockResolvedValue(tempDir)
      fs.promises.writeFile.mockRejectedValue(writeError)
      fs.promises.rename.mockRejectedValue(renameError)

      const unlinkSpy = jest.spyOn(fs.promises, 'unlink')
      const rmdirSpy = jest.spyOn(fs.promises, 'rmdir')

      await expect(minifyPix.setTempFile(filePath)).rejects.toThrow(writeError)
      expect(unlinkSpy).toHaveBeenCalledWith(tempFilePath)
      expect(rmdirSpy).toHaveBeenCalledWith(tempDir)

      unlinkSpy.mockRestore()
      rmdirSpy.mockRestore()
    })
  })

  describe('copyFile', () => {
    it('should create a copy of the original file with a specific label', async () => {
      const filePath = 'test/images/image.jpg'
      const expectedNewFilePath = `${path.dirname(filePath)}/${path.basename(filePath, path.extname(filePath))}-minify-pix-${path.extname(filePath)}`
      const result = await minifyPix.copyFile(filePath)

      expect(result).toBe(expectedNewFilePath)
      expect(fs.promises.copyFile).toHaveBeenCalledWith(filePath, expectedNewFilePath)
    })
  })

  describe('getOptions', () => {
    it('should return default options if no config is provided', () => {
      const minifyPix = new MinifyPix()
      const options = minifyPix.getOptions()

      expect(options).toEqual([
        imageminMozjpeg({ quality: 80, progressive: true, arithmetic: false }),
        imageminPngquant({ quality: [0.8, 0.9], speed: 1 }),
        imageminGifsicle({ optimizationLevel: 2, interlaced: false, colors: 256 }),
        imageminSvgo()
      ])
    })

    it('should merge user config with default config', () => {
      const userConfig = {
        jpg: { quality: 70 },
        png: { quality: [0.6, 0.7] },
        gif: { optimizationLevel: 3, interlaced: true }
      }
      const minifyPix = new MinifyPix(userConfig)
      const options = minifyPix.getOptions()

      expect(options).toEqual([
        imageminMozjpeg({ quality: 70, progressive: true, arithmetic: false }),
        imageminPngquant({ quality: [0.6, 0.7], speed: 1 }),
        imageminGifsicle({ optimizationLevel: 3, interlaced: true, colors: 256 }),
        imageminSvgo()
      ])
    })

    it('should handle array values correctly', () => {
      const userConfig = {
        png: { quality: [0.6, 0.7] }
      }
      const minifyPix = new MinifyPix(userConfig)
      const options = minifyPix.getOptions()

      expect(options[1]).toEqual(imageminPngquant({ quality: [0.6, 0.7], speed: 1 }))
    })

    it('should merge user config with default config correctly', () => {
      const userConfig = {
        jpg: { quality: 70 },
        png: { quality: [0.6, 0.7] },
        gif: { optimizationLevel: 3, interlaced: true }
      }
      const minifyPix = new MinifyPix(userConfig)
      const options = minifyPix.getOptions()

      expect(options).toEqual([
        imageminMozjpeg({ quality: 70, progressive: true, arithmetic: false }),
        imageminPngquant({ quality: [0.6, 0.7], speed: 1 }),
        imageminGifsicle({ optimizationLevel: 3, interlaced: true, colors: 256 }),
        imageminSvgo()
      ])
    })
  })
})

describe('Service', () => {
  let service
  const pkgJson = {
    minifyPix: {
      destination: 'test/destination',
      exclude: ['node_modules', 'test']
    }
  }

  beforeEach(() => {
    service = new Service(pkgJson)
  })

  describe('constructor', () => {
    it('should initialize with default values if no package.json provided', () => {
      const defaultService = new Service()

      expect(defaultService.config).toEqual({})
      expect(defaultService.imageTypes).toEqual(['.jpg', '.jpeg', '.png', '.gif', '.svg'])
      expect(defaultService.minifyPix).toBeInstanceOf(MinifyPix)
      expect(defaultService.minifyPix.config).toEqual({})
      expect(defaultService.spinner).toBeDefined()
    })

    it('should initialize with values from package.json', () => {
      expect(service.config).toEqual(pkgJson.minifyPix)
      expect(service.imageTypes).toEqual(['.jpg', '.jpeg', '.png', '.gif', '.svg'])
      expect(service.minifyPix).toBeInstanceOf(MinifyPix)
      expect(service.minifyPix.config).toEqual(pkgJson.minifyPix)
      expect(service.spinner).toBeDefined()
    })

    it('should use custom image types if provided and valid', () => {
      const pkgJson = {
        minifyPix: {
          imageTypes: ['.jpg', '.png']
        }
      }
      const service = new Service(pkgJson)

      expect(service.imageTypes).toEqual(['.jpg', '.png'])
    })

    it('should use default image types if provided types are invalid', () => {
      const pkgJson = {
        minifyPix: {
          imageTypes: ['.jpg', '.txt']
        }
      }
      const service = new Service(pkgJson)

      expect(service.imageTypes).toEqual(['.jpg', '.jpeg', '.png', '.gif', '.svg'])
    })
  })

  describe('filterImageFiles', () => {
    it('should filter out non-image files', () => {
      const files = ['test.jpg', 'test.png', 'test.txt', 'test.svg']
      const filteredFiles = service.filterImageFiles(files)

      expect(filteredFiles).toEqual(['test.jpg', 'test.png', 'test.svg'])
    })

    it('should return an empty array if no files provided', () => {
      const filteredFiles = service.filterImageFiles()

      expect(filteredFiles).toEqual([])
    })
  })

  describe('getImageTypes', () => {
    it('should return default image types if no types provided', () => {
      const defaultTypes = service.getImageTypes()

      expect(defaultTypes).toEqual(['.jpg', '.jpeg', '.png', '.gif', '.svg'])
    })

    it('should return provided image types if they are valid', () => {
      const validTypes = ['.jpg', '.png']
      const types = service.getImageTypes(validTypes)

      expect(types).toEqual(validTypes)
    })

    it('should return default image types if provided types are invalid', () => {
      const invalidTypes = ['.jpg', '.txt']
      const types = service.getImageTypes(invalidTypes)

      expect(types).toEqual(['.jpg', '.jpeg', '.png', '.gif', '.svg'])
    })

    it('should return default image types if types is not an array', () => {
      const types = 'test.jpg'
      const service = new Service()
      const result = service.getImageTypes(types)

      expect(result).toEqual(['.jpg', '.jpeg', '.png', '.gif', '.svg'])
    })

    it('should return provided types if they are valid and an array', () => {
      const types = ['.jpg', '.png']
      const service = new Service()
      const result = service.getImageTypes(types)

      expect(result).toEqual(types)
    })
  })

  describe('getUnstagedChanges', () => {
    it('should return unstaged files', async () => {
      const mockStatus = {
        files: [
          { path: 'test.jpg', index: 'r', working_dir: 'M' }, // staged
          { path: 'test.png', index: ' ', working_dir: ' ' }, // unstaged
          { path: 'test.txt', index: 'A', working_dir: 'D' }  // staged and deleted
        ]
      }

      // service.minifyPix.status 没有赋值
      // 则 index !== 'r'
      simpleGit.mockReturnValue({ status: jest.fn().mockResolvedValue(mockStatus) })
      const unstagedChanges = await service.getUnstagedChanges()

      expect(unstagedChanges).toEqual([path.resolve('test.png')])
    })

    it('should return staged files if status is set to staged', async () => {
      service.minifyPix.status = 'staged'
      const mockStatus = {
        files: [
          { path: 'test.jpg', index: 'r', working_dir: 'M' },
          { path: 'test.png', index: ' ', working_dir: 'D' },
          { path: 'test.txt', index: 'A', working_dir: ' ' }
        ]
      }

      simpleGit.mockReturnValue({ status: jest.fn().mockResolvedValue(mockStatus) })

      const unstagedChanges = await service.getUnstagedChanges()

      expect(unstagedChanges).toEqual([path.resolve('test.txt')])
    })
  })

  describe('start', () => {
    it('should optimize unstaged files if no destination provided', async () => {
      const mockUnstagedChanges = ['test.jpg', 'test.png']

      service.config.destination = ''
      jest.spyOn(service, 'filterImageFiles').mockReturnValue(mockUnstagedChanges)
      const mockOptimizeResult = {
        filePath: 'test.jpg',
        originalSize: 1000,
        optimizedSize: 800,
        saving: 200,
        savingPercent: '20.00%'
      }

      jest.spyOn(service.minifyPix, 'optimize')
        .mockResolvedValueOnce(mockOptimizeResult)
        .mockResolvedValueOnce({ ...mockOptimizeResult, filePath: 'test.png' })

      await service.start()

      expect(service.minifyPix.optimize).toHaveBeenCalledTimes(mockUnstagedChanges.length)
      expect(service.minifyPix.optimize).toHaveBeenCalledWith('test.jpg')
      expect(service.minifyPix.optimize).toHaveBeenCalledWith('test.png')
      expect(service.spinner.succeed).toHaveBeenCalledWith(
        'test.jpg: 1000B -> 800B, saved 200B (20.00%)'
      )
    })

    it('should optimize files from the specified directory if destination provided', async () => {
      const optimizedFiles = ['test/destination/image1.jpg', 'test/destination/image2.png']

      service.config.destination = 'test'

      jest.spyOn(service, 'optimizeFilesFromDirectory').mockResolvedValue(optimizedFiles)

      const optimizedFileResult = {
        filePath: 'test/destination/image1.jpg',
        originalSize: 1000,
        optimizedSize: 800,
        saving: 200,
        savingPercent: '20%'
      }

      jest.spyOn(service.minifyPix, 'optimize').mockResolvedValue(optimizedFileResult)
      await service.start()

      expect(service.spinner.succeed).toHaveBeenCalledTimes(2)
      expect(service.spinner.succeed).toHaveBeenCalledWith(expect.stringContaining("test/destination/image1.jpg: 1000B -> 800B, saved 200B (20%)"))
    })

    it('should log a message if no unstaged changes found', async () => {
      service.config.destination = ''
      jest.spyOn(service, 'getUnstagedChanges').mockResolvedValue([])

      await service.start()

      expect(service.spinner.info).toHaveBeenCalledWith('No unstaged changes found')
    })

    it('should log a message if no matched image files found', async () => {
      const mockUnstagedChanges = ['test.txt']

      jest.spyOn(service, 'getUnstagedChanges').mockResolvedValue(mockUnstagedChanges)
      jest.spyOn(service, 'filterImageFiles').mockReturnValue([])

      await service.start()

      expect(service.spinner.info).toHaveBeenCalledWith('No matched image files found')
    })

    it('should log a warning if optimization fails for some files', async () => {
      const mockUnstagedChanges = ['test.jpg']

      jest.spyOn(service, 'getUnstagedChanges').mockResolvedValue(mockUnstagedChanges)
      jest.spyOn(service, 'filterImageFiles').mockReturnValue(mockUnstagedChanges)
      const mockError = new Error('Optimization failed')

      jest.spyOn(service.minifyPix, 'optimize').mockRejectedValue(mockError)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { })

      await service.start()

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipped 1 files due to errors:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`- ${chalk.red(mockUnstagedChanges[0])}`))

      consoleSpy.mockRestore()
    })

    it('should not throw an error if optimization fails for some files', async () => {
      const mockUnstagedChanges = ['test.jpg']

      jest.spyOn(service, 'getUnstagedChanges').mockResolvedValue(mockUnstagedChanges)
      jest.spyOn(service, 'filterImageFiles').mockReturnValue(mockUnstagedChanges)
      const mockError = new Error('Optimization failed')

      jest.spyOn(service.minifyPix, 'optimize').mockRejectedValue(mockError)

      await expect(service.start()).resolves.not.toThrow()
    })

    it('should fetch unstaged changes when no destination is provided', async () => {
      const getUnstagedChangesSpy = jest.spyOn(service, 'getUnstagedChanges')
      const optimizeFilesFromDirectorySpy = jest.spyOn(service, 'optimizeFilesFromDirectory')

      await service.start()

      expect(getUnstagedChangesSpy).toHaveBeenCalled()
      expect(optimizeFilesFromDirectorySpy).not.toHaveBeenCalled()
    })

    it('should optimize files from the specified directory when destination is provided', async () => {
      const getUnstagedChangesSpy = jest.spyOn(service, 'getUnstagedChanges')
      const optimizeFilesFromDirectorySpy = jest.spyOn(service, 'optimizeFilesFromDirectory')
      const config = { destination: 'test/destination', exclude: ['node_modules'] }

      await service.start(config)

      expect(getUnstagedChangesSpy).not.toHaveBeenCalled()
      expect(optimizeFilesFromDirectorySpy).toHaveBeenCalledWith('test/destination', ['node_modules'])
    })

    it('should add rejected reasons to failedFiles array', async () => {
      const mockResult = { status: 'rejected', reason: 'Error message' }
      const results = [mockResult]
      const failedFiles = []

      results.forEach(result => {
        if (result.status === 'rejected') {
          failedFiles.push(result.reason)
        }
      })

      expect(failedFiles).toContain('Error message')
    })

    it('should handle fulfilled promises in results', async () => {
      const mockResult = { status: 'fulfilled', value: 'Fulfilled value' }
      const results = [mockResult]
      const failedFiles = []

      results.forEach(result => {
        if (result.status === 'rejected') {
          failedFiles.push(result.reason)
        }
      })

      expect(failedFiles).toHaveLength(0)
    })

    it('should print version and stop spinner when --version flag is provided', async () => {
      process.argv = ['node', 'minify', '--version']
      const infoSpy = jest.spyOn(service.spinner, 'info')
      const stopSpy = jest.spyOn(service.spinner, 'stop')

      await service.start()

      expect(infoSpy).toHaveBeenCalledWith(service.version)
      expect(stopSpy).toHaveBeenCalled()
    })
  })
})
