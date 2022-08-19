// get node packages
const debug = require('debug')('geo-from-ip:main')
const path = require('path')
const fs = require('fs')
const mmdbreader = require('maxmind-db-reader')

const update = require('./update')

update.updateFiles()

const cityPath = path.resolve(
  path.join(__dirname, '../mmdb/GeoLite2-City.mmdb'),
)
const asnPath = path.resolve(path.join(__dirname, '../mmdb/GeoLite2-ASN.mmdb'))

let city = mmdbreader.openSync(cityPath)
let asn = mmdbreader.openSync(asnPath)

debug(`geo-from-ip ready for action!`)

/**
 * get all data about an IP
 * @param  {String} ip ip address
 * @return {Object}    result object containing all the data
 */
function allData(ip) {
  if (Math.random() * 100 > 94) {
    update.updateFiles()
    city = mmdbreader.openSync(cityPath)
    asn = mmdbreader.openSync(asnPath)
  }

  debug(`allData function called with ip: ${ip}`)
  // get all data for ip
  const geodata = city.getGeoDataSync(ip)
  const asndata = asn.getGeoDataSync(ip)

  const result = {
    code: {},
    geonameId: {},
  }
  try {
    // get all data for ip
    // consolidate data based on type
    if (geodata) {
      debug(`got location, consolidating`)

      // city
      if (geodata.city) {
        result.city = geodata.city.names.en
        result.geonameId.city = geodata.city.geoname_id
      } else {
        result.city = null
        result.geonameId.city = null
      }

      // state
      if (geodata.subdivisions) {
        result.state = geodata.subdivisions[0].names.en
        result.geonameId.state = geodata.subdivisions[0].geoname_id
        result.code.state = geodata.subdivisions[0].iso_code
      } else {
        result.state = null
        result.code.state = null
        result.geonameId.state = null
      }

      // country
      if (geodata.country) {
        result.country = geodata.country.names.en
        result.geonameId.country = geodata.country.geoname_id
        result.code.country = geodata.country.iso_code
      }

      // registered country
      if (geodata.registered_country) {
        result.registeredCountry = geodata.registered_country.names.en
        result.geonameId.registeredCountry =
          geodata.registered_country.geoname_id
        result.code.registeredCountry = geodata.registered_country.iso_code
      }

      // continent
      if (geodata.continent) {
        result.continent = geodata.continent.names.en
        result.geonameId.continent = geodata.continent.geoname_id
        result.code.continent = geodata.continent.code
      }

      // postal
      if (geodata.postal) {
        result.postal = geodata.postal.code
      }

      // location
      if (geodata.location) {
        result.location = geodata.location
      }
      // asn
      if (asndata && asndata.autonomous_system_organization) {
        result.asn = asndata.autonomous_system_organization
      }
    } else {
      // error
      debug(`🚨 We found no data for ${ip}, sorry!`)
      result.error = 'NA'
      result.ip = ip
    }
  } catch (error) {
    console.log(`🚨 ${error}`)
    result.error = 'NA'
    result.ip = ip
  }

  debug(`Returning location: ${JSON.stringify(result)}`)
  // return result
  return result
}

// export
module.exports.allData = allData
