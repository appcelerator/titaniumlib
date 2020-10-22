/**
 * A list of options that can be changed by the parent program.
 * @type {Object}
 */
const options = {
	searchPaths: [],
	network: {
		caFile:    null,
		certFile:  null,
		keyFile:   null,
		proxy:     null,
		strictSSL: true
	},
	sdk: {
		searchPaths: [],
		urls: {
			branches: 'http://builds.appcelerator.com/mobile/branches.json',
			build:    'http://builds.appcelerator.com/mobile/<BRANCH>/<FILENAME>',
			builds:   'http://builds.appcelerator.com/mobile/<BRANCH>/index.json',
			releases: 'https://appc-mobilesdk-server.s3-us-west-2.amazonaws.com/releases.json'
		}
	},
	module: {
		searchPaths: []
	}
};

export default options;
