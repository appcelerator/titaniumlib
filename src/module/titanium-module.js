import fs from 'fs';
import path from 'path';
import semver from 'semver';
import { expandPath } from 'appcd-path';
import { isDir } from 'appcd-fs';

/**
 * Cached regex for matching key/values in properties files.
 * @type {RegExp}
 */
const iniRegExp = /^(?!\s*#)\s*([^:\s]+)\s*:\s*(.+?)\s*$/;

/**
 * Checks if string is a number.
 * @type {RegExp}
 */
const numberRegExp = /^\d+(\.\d*)?$/;

/**
 * Titanium Module information object.
 */
export default class TitaniumModule {
	/**
	 * Checks if the specified directory contains a Titanium Module.
	 *
	 * @param {String} dir - The directory to scan.
	 * @access public
	 */
	constructor(dir) {
		if (typeof dir !== 'string' || !dir) {
			throw new TypeError('Expected directory to be a valid string');
		}

		dir = expandPath(dir);
		if (!isDir(dir)) {
			throw new Error('Directory does not exist');
		}

		this.path     = dir;
		this.platform = path.basename(path.dirname(path.dirname(dir)));
		this.version  = path.basename(dir);

		try {
			const manifestFile = path.join(dir, 'manifest');

			for (const line of fs.readFileSync(manifestFile, 'utf8').split(/\r?\n/)) {
				const m = line.match(iniRegExp);
				if (m) {
					if (numberRegExp.test(m[2]) && m[1] !== 'version') {
						const val = parseFloat(m[2]);
						if (!isNaN(val)) {
							this[m[1]] = val;
							continue;
						}
					}
					this[m[1]] = m[2];
				}
			}
		} catch (e) {
			throw new Error('Directory does not contain a valid manifest');
		}

		if (!this.platform.trim().length) {
			throw new Error('Expected platform to be a valid string');
		}

		if (this.platform === 'iphone') {
			this.platform = 'ios';
		}

		if (!semver.valid(this.version)) {
			throw new Error(`Version "${this.version}" is not valid`);
		}
	}
}
