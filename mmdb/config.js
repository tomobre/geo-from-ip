'use strict'

// where your GeoIP databases are stored
exports.dbDir = __dirname

// local:filename, remote:geolite-url
exports.geoIpDbs = (licenseKey) => [
  {
    filename: 'GeoLite2-City',
    remote: `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${licenseKey}&suffix=tar.gz`,
  },
  {
    filename: 'GeoLite2-ASN',
    remote: `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-ASN&license_key=${licenseKey}&suffix=tar.gz`,
  },
]
