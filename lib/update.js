'use strict'

const debug = require('debug')('geo-from-ip:updater')
const fs = require('fs')
const path = require('path')
const util = require('util')
const streamPipeline = util.promisify(require('stream').pipeline)
const fetch = require('node-fetch')
const targz = require('targz')
const config = require('../mmdb/config')

/**
 * uncompresses the zipped file into folders and does cleanup of remaining files and folders
 * @param {String} zipped path to zipped file
 * @param {Object} database database object
 */
async function uncompress(zipped, database) {
  new Promise((resolve, reject) => {
    targz.decompress(
      {
        src: zipped,
        dest: config.dbDir,
        tar: {
          ignore: function (name) {
            return path.extname(name) !== '.mmdb'
          },
        },
      },
      (err) => {
        if (err) {
          debug(err)
          reject()
        } else {
          fs.readdirSync(config.dbDir).forEach((file) => {
            if (fs.lstatSync(`${config.dbDir}/${file}`).isDirectory()) {
              fs.renameSync(
                `${config.dbDir}/${file}/${database.filename}.mmdb`,
                `${config.dbDir}/${database.filename}.mmdb`,
              )
              fs.rmdirSync(`${config.dbDir}/${file}`)
            }
          })
          fs.unlinkSync(`${config.dbDir}/${database.filename}.tar.gz`)
          resolve()
        }
      },
    )
  })
}

/**
 * download database and unzip
 *
 * @param {Object} database database to download
 */
async function download(database) {
  const zipped = `${config.dbDir}/${database.filename}.tar.gz`
  const response = await fetch(database.remote)
  await streamPipeline(response.body, fs.createWriteStream(zipped))
  console.log('download complete, uncompressing')
  await uncompress(zipped, database)
  console.log('ready!')
}

/**
 * check if remote file is newer
 *
 * @param  {Object}   database  database to download
 */
async function isRemoteNewer(database) {
  const mmdb = `${config.dbDir}/${database.filename}.mmdb`
  // if no file
  if (!fs.existsSync(mmdb)) {
    console.log('file does not exist')
    return true
  } else {
    // if dest file is not a file, remove it
    const stats = fs.statSync(mmdb)
    if (!stats.isFile()) {
      debug(`${mmdb} is not a file`)
      fs.unlinkSync(mmdb, () => {
        debug(`${mmdb} deleted`)
      })
    }

    const response = await fetch(database.remote, {
      method: 'HEAD',
    })

    const remoteDate = new Date(response.headers.get('last-modified'))
      .toISOString()
      .split('T')[0]
    const localDate = new Date(stats.mtime.toUTCString())
      .toISOString()
      .split('T')[0]
    return new Date(remoteDate) > new Date(localDate)
  }
}

/**
 * sync databases to local
 */
function sync(licenseKey) {
  console.log('getting data')
  config.geoIpDbs(licenseKey).forEach(async (database) => {
    console.log(database)
    if (await isRemoteNewer(database)) {
      console.log('remote is newer, downloading')
      await download(database)
    } else {
      console.log('local is newer, skipping')
    }
  })
}

module.exports = sync
