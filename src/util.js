import fs from 'fs-extra';
import options from './options';
import path from 'path';
import request from 'request';
import semver from 'semver';
import snooplogg from 'snooplogg';
import yauzl from 'yauzl';

import { arch } from 'appcd-util';
import { isFile } from 'appcd-fs';
import { STATUS_CODES } from 'http';

const { log } = snooplogg;
const { highlight } = snooplogg.styles;

/**
 * The current machine's architecture.
 * @type {String}
 */
export const architecture = arch();

/**
 * The current machine's operating system.
 * @type {String}
 */
export const os = process.platform === 'darwin' ? 'osx' : process.platform;

/**
 * Mixes the network options into the request params.
 *
 * @param {Object} params - Various request parameters.
 * @returns {Object}
 */
export function buildRequestParams(params) {
	const { network } = options;

	if (!params.agentOptions && network.agentOptions) {
		Object.assign(params.agentOptions, network.agentOptions);
	}

	if (!params.ca && network.caFile && isFile(network.caFile)) {
		params.ca = fs.readFileSync(network.caFile);
	}

	if (!params.cert && network.certFile && isFile(network.certFile)) {
		params.cert = fs.readFileSync(network.certFile);
	}

	if (!params.proxy && params.url && (network.httpsProxy || network.httpProxy)) {
		if (/^https/.test(params.url)) {
			params.proxy = network.httpsProxy || network.httpProxy;
		} else {
			params.proxy = network.httpProxy || network.httpsProxy;
		}
	}

	if (!params.key && network.keyFile && isFile(network.keyFile)) {
		params.key = fs.readFileSync(network.keyFile);
	}

	if (!params.passphrase && network.passphrase) {
		params.passphrase = network.passphrase;
	}

	if (params.strictSSL === undefined && network.strictSSL !== undefined) {
		params.strictSSL = network.strictSSL;
	}

	return params;
}

/**
 * Extracts a zip file to the specified destination.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.dest - The destination to extract the file.
 * @param {String} params.file - The path to the zip file to extract.
 * @param {Function} [params.onEntry] - A callback to fire per entry.
 * @returns {Promise}
 */
export async function extractZip(params) {
	if (!params || typeof params !== 'object') {
		throw new TypeError('Expected params to be an object');
	}

	let { dest, file } = params;

	if (!dest || typeof dest !== 'string') {
		throw new TypeError('Expected destination directory to be a non-empty string');
	}

	if (!file || typeof file !== 'string') {
		throw new TypeError('Expected zip file to be a non-empty string');
	}

	if (!fs.existsSync(file)) {
		throw new Error('The specified zip file does not exist');
	}

	if (!isFile(file)) {
		throw new Error('The specified zip file is not a file');
	}

	log(`Extracting ${highlight(file)} => ${highlight(dest)}`);

	await new Promise((resolve, reject) => {
		yauzl.open(file, { lazyEntries: true }, (err, zipfile) => {
			if (err) {
				return reject(new Error(`Invalid zip file: ${err.message || err}`));
			}

			let idx = 0;
			const total = zipfile.entryCount;
			const abort = err => {
				zipfile.removeListener('end', resolve);
				zipfile.close();
				reject(err);
			};

			zipfile
				.on('entry', entry => {
					idx++;
					if (typeof params.onEntry === 'function') {
						try {
							params.onEntry(entry.fileName, idx, total);
						} catch (e) {
							return reject(e);
						}
					}

					const fullPath = path.join(dest, entry.fileName);
					let mode = (entry.externalFileAttributes >>> 16) & 0xFFFF;

					const symlink = (mode & fs.constants.S_IFMT) === fs.constants.S_IFLNK;
					let isDir = (mode & fs.constants.S_IFMT) === fs.constants.S_IFDIR;

					// check for windows weird way of specifying a directory
					// https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
					const madeBy = entry.versionMadeBy >> 8;
					if (!isDir) {
						isDir = (madeBy === 0 && entry.externalFileAttributes === 16);
					}

					if (mode === 0) {
						mode = 0o644;
					}

					if (symlink) {
						fs.mkdirp(path.dirname(fullPath), () => {
							zipfile.openReadStream(entry, (err, readStream) => {
								if (err) {
									return abort(err);
								}

								const chunks = [];
								readStream.on('data', chunk => chunks.push(chunk));
								readStream.on('error', abort);
								readStream.on('end', () => {
									let str = Buffer.concat(chunks).toString('utf8');
									fs.symlinkSync(str, fullPath);
									zipfile.readEntry();
								});
							});
						});
					} else if (isDir) {
						fs.mkdirp(fullPath, () => zipfile.readEntry());
					} else {
						fs.mkdirp(path.dirname(fullPath), () => {
							zipfile.openReadStream(entry, (err, readStream) => {
								if (err) {
									return abort(err);
								}

								const writeStream = fs.createWriteStream(fullPath,  {
									mode
								});
								writeStream.on('close', () => zipfile.readEntry());
								writeStream.on('error', abort);
								readStream.pipe(writeStream);
							});
						});
					}
				})
				.once('end', resolve)
				.readEntry();
		});
	});
}

/**
 * Fetches a URL and parses the result as JSON.
 *
 * @param {String} url - The URL to request.
 * @returns {Promise} Resolves the parsed body.
 */
export function fetchJSON(url) {
	return new Promise((resolve, reject) => {
		log(`Fetching ${highlight(url)}`);
		request(buildRequestParams({ method: 'GET', url }), (err, response, body) => {
			if (err) {
				return reject(err);
			}

			// istanbul ignore if
			if (!response) {
				return reject(new Error('Request error: no response'));
			}

			const { statusCode } = response;

			if (statusCode >= 400) {
				return reject(new Error(`${statusCode} ${STATUS_CODES[statusCode]}`));
			}

			try {
				resolve(JSON.parse(body));
			} catch (e) {
				reject(new Error('Request error: malformed JSON response'));
			}
		});
	});
}

/**
 * Version number comparison helpers.
 *
 * @type {Object}
 */
export const version = {
	format(ver, min, max, chopDash) {
		ver = ('' + (ver || 0));
		if (chopDash) {
			ver = ver.replace(/(-.*)?$/, '');
		}
		ver = ver.split('.');
		if (min !== undefined) {
			while (ver.length < min) {
				ver.push('0');
			}
		}
		if (max !== undefined) {
			ver = ver.slice(0, max);
		}
		return ver.join('.');
	},
	eq(v1, v2) {
		return semver.eq(version.format(v1, 3, 3), version.format(v2, 3, 3));
	},
	lt(v1, v2) {
		return semver.lt(version.format(v1, 3, 3), version.format(v2, 3, 3));
	},
	rcompare(v1, v2) {
		return version.eq(v1, v2) ? 0 : version.lt(v1, v2) ? 1 : -1;
	}
};
