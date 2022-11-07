'use strict'

const debug = require('debug')('geo-from-ip:updater')
const fs = require('fs')
const path = require('path')
const util = require('util')
const streamPipeline = util.promisify(require('stream').pipeline)
const fetch = require('node-fetch')
const targz = require('targz')
const { execSync } = require('child_process');

if (process.env.MAXMIND_LICENSE_KEY === undefined) {
  console.log(
    'Seems like you forgot to add MAXMIND_LICENSE_KEY to your environment variables. Read more: https://github.com/VikramTiwari/geo-from-ip#how-to-use',
  )
  process.exit(1)
}

const config = require('../mmdb/config')

/**
 * uncompresses the zipped file into folders and does cleanup of remaining files and folders
 * @param {String} zipped path to zipped file
 * @param {Object} database database object
 */
async function uncompress(zipped, database) {
  return new Promise((resolve, reject) => {
    console.log('uncompressing')
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
          console.log(err)
          // reject()
          resolve()
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
      console.log(`${mmdb} is not a file`)
      fs.unlinkSync(mmdb, () => {
        console.log(`${mmdb} deleted`)
      })
    }

    const response = await fetch(database.remote, {
      method: 'GET',
      headers: {
        'If-Modified-Since': stats.mtime.toUTCString(),
      },
    })

    if (response === null) {
      return true
    }
    return false
  }
}

function sync() {
  while (fs.existsSync('./updating.txt')) {
    const { mtime, ctime } = fs.statSync('./updating.txt')
    const differenceSeconds = Math.abs((new Date().getTime() - mtime.getTime()) / 1000);
    if (differenceSeconds < 60 * 5) {
      execSync('sleep 1');
    } else {
      if (fs.existsSync('./updating.txt')) fs.unlinkSync('./updating.txt');
    }
  }
  return new Promise(function (resolve, reject) {
    Promise.all(
      config.geoIpDbs.map(async (database) => {
        if (await isRemoteNewer(database)) {
          if (!fs.existsSync('./updating.txt')) fs.closeSync(fs.openSync('./updating.txt', 'w'));
          console.log('remote is newer, downloading')
          await download(database)
        } else {
          console.log('remote is up to date, not downloading')
        }
      }),
    )
      .then(() => {
        console.log('sync done')
        resolve(true)
      })
      .catch((err) => {
        reject(err)
      })
      .finally(() => {
        if (fs.existsSync('./updating.txt')) fs.unlinkSync('./updating.txt');
        console.log('exiting sync')
      })
  })
}

function updateFiles() {
  let result
  sync().then((r) => (result = r))
  while (result === undefined || fs.existsSync('./updating.txt'))
    // Wait result from async_function
    require('deasync').sleep(100)
}
module.exports.updateFiles = updateFiles
