import fs from 'fs-extra';
import path from 'path';
import options from '../options';
import snooplogg from 'snooplogg';
import TitaniumModule from './titanium-module';
import tmp from 'tmp';
import * as request from '@axway/amplify-request';
import { arrayify, cacheSync, get, unique } from 'appcd-util';
import { expandPath } from 'appcd-path';
import { extractZip, TaskTracker } from '../util';
import { getInstallPaths } from '../locations';
import { isDir, isFile } from 'appcd-fs';

export { TitaniumModule };

const { log } = snooplogg;
const { highlight } = snooplogg.styles;

/**
 * A regex to test if a string is a URL or path to a zip file.
 * @type {RegExp}
 */
const uriRegExp = /^(https?:\/\/.+)|(?:file:\/\/(.+))$/;

/**
 * Detect Titanium modules
 *
 * @param {Boolean} [force] - When true ignore the cache
 * @returns {Object}
 */
export function getInstalledModules(force) {
	return cacheSync('titaniumlib:modules', force, () => {
		const results = {};

		for (let dir of getPaths()) {
			if (!isDir(dir)) {
				continue;
			}

			for (const platform of fs.readdirSync(dir)) {
				const platformDir = path.join(dir, platform);
				if (!isDir(platformDir)) {
					continue;
				}

				for (const moduleName of fs.readdirSync(platformDir)) {
					const moduleDir = path.join(platformDir, moduleName);
					if (!isDir(moduleDir)) {
						continue;
					}

					for (const version of fs.readdirSync(moduleDir)) {
						const versionDir = path.join(moduleDir, version);
						try {
							const tiModule = new TitaniumModule(versionDir);
							if (!results[platform]) {
								results[platform] = {};
							}
							if (!results[platform][tiModule.moduleid]) {
								results[platform][tiModule.moduleid] = {};
							}
							results[platform][tiModule.moduleid][tiModule.version] = tiModule;
						} catch (e) {
							// Do nothing
						}
					}
				}
			}
		}

		return results;
	});
}

/**
 * Returns a list of possible module install paths.
 *
 * @returns {Array.<String>}
 */
export function getPaths() {
	return unique([
		...arrayify(get(options, 'module.searchPaths'), true).map(p => expandPath(p)),
		...getInstallPaths().map(p => expandPath(p, 'modules'))
	]);
}

/**
 * Installs a Titanium module from a URL or local file.
 *
 * @param {Object} params - Various parameters.
 * @param {Context} [params.downloadDir] - The directory to download the module to when `uri` is a
 * URL.
 * @param {String} [params.installDir] - The path to install the module into. Defaults to the first
 * path in the list of Titanium install locations.
 * @param {Boolean} [params.keep=false] - When `true` and `uri` is a URL and `downloadDir` is
 * specified, then the downloaded module `.zip` file is not deleted after install.
 * @param {Function} [params.onProgress] - A callback to fire when install progress is updated.
 * @param {Boolean} [params.overwrite=false] - When `true`, overwrites an existing module,
 * otherwise an error is thrown.
 * @param {String} params.uri - A URI to a local file or remote URL to download.
 * @returns {Promise<TitaniumModule>}
 */
export async function install(params = {}) {
	if (!params || typeof params !== 'object') {
		throw new TypeError('Expected params to be an object');
	}

	if (!params.uri && typeof params.uri !== 'string') {
		throw new TypeError('Expected URI to be a URL or local path to a zip file');
	}

	const tracker = new TaskTracker(params.onProgress, [
		'Extracting module',
		'Installing module'
	]);

	const titaniumDir = params.installDir ? expandPath(params.installDir) : getInstallPaths()[0];
	if (!titaniumDir) {
		throw new Error('Unable to determine the Titanium directory');
	}

	// step 1: determine what the uri is

	const uriMatch     = params.uri.match(uriRegExp);
	let downloadedFile = null;
	let url            = uriMatch?.[1];
	let file           = uriMatch?.[2];

	if (url) {
		// step 1.5: download the file

		tracker.tasks.unshift('Downloading module');
		tracker.startTask();

		let { downloadDir } = params;
		if (downloadDir) {
			downloadedFile = path.join(downloadDir, `titanium-module-download-${Date.now()}.zip`);
		} else {
			downloadedFile = tmp.tmpNameSync({
				prefix: 'titaniumlib-',
				postfix: '.zip'
			});
			downloadDir = path.dirname(downloadedFile);
			params.keep = false;
		}
		await fs.mkdirp(downloadDir);

		file = await new Promise((resolve, reject) => {
			log(`Downloading ${highlight(url)} => ${highlight(downloadedFile)}`);
			const got = request.init({ defaults: options.network });
			const stream = got.stream(url, { retry: 0 })
				.on('downloadProgress', ({ percent }) => tracker.progress(percent))
				.on('error', reject)
				.on('response', response => {
					const { headers } = response;
					const cd = headers['content-disposition'];
					let m = cd && cd.match(/filename[^;=\n]*=['"]*(.*?\2|[^'";\n]*)/);
					let filename = m && m[1];

					// try to determine the file extension by the filename in the url
					if (!filename && (m = url.match(/.*\/(.+\.zip)$/))) {
						filename = m[1];
					}

					const out = fs.createWriteStream(downloadedFile);
					out.on('error', reject);
					out.on('close', () => {
						tracker.endTask();

						let file = downloadedFile;
						if (filename) {
							file = path.join(downloadDir, filename);
							log(`Renaming ${highlight(downloadedFile)} => ${highlight(file)}`);
							fs.moveSync(downloadedFile, file, { overwrite: true });
						}
						resolve(file);
					});
					stream.pipe(out);
				});
		});
	} else {
		if (!file) {
			file = params.uri;
		}

		file = expandPath(file);

		if (!isFile(file)) {
			const err = new Error('URI is not a valid URL or local zip file');
			err.code = 'ENOTFOUND';
			throw err;
		}

		if (!/\.zip$/.test(file)) {
			const err = new Error('Specified file URI is not a zip file');
			err.code = 'ENOTFOUND';
			throw err;
		}
	}

	// step 2: extract the sdk zip file

	const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-' });
	const modules = [];

	log(`Using Titanium directory: ${highlight(titaniumDir)}`);

	try {
		tracker.startTask();
		await extractZip({
			dest: tempDir,
			file,
			onEntry(filename, idx, total) {
				tracker.progress(idx / total);
			}
		});
		tracker.endTask();

		// step 3: move the sdk files to the dest

		tracker.startTask(false);
		for (const name of [ 'modules', 'plugins' ]) {
			const src = [ tempDir, name ];
			const dest = path.join(titaniumDir, name);
			log(`Moving module files: ${highlight(path.join(...src))} => ${highlight(dest)}`);

			(function walk(src, dest) {
				const srcPath = path.join(...src);
				if (!isDir(srcPath)) {
					return;
				}

				fs.mkdirsSync(dest);

				for (const name of fs.readdirSync(srcPath)) {
					const file = path.join(srcPath, name);

					if (isDir(file)) {
						src.push(name);
						walk(src, path.join(dest, name));
						src.pop();
					} else {
						fs.renameSync(file, path.join(dest, name));
						if (src.length === 5 && src[1] === 'modules' && name === 'manifest') {
							modules.push(dest);
						}
					}
				}
			}(src, dest));
		}
		tracker.endTask();
	} finally {
		log(`Removing ${highlight(tempDir)}`);
		await fs.remove(tempDir);
	}

	if (downloadedFile && !params.keep) {
		log(`Removing ${highlight(downloadedFile)}`);
		await fs.remove(downloadedFile);
	}

	if (modules.length) {
		log('Installed modules:');
		for (const dir of modules) {
			log(`  ${highlight(dir)}`);
		}
	} else {
		log('No modules installed!');
	}

	return modules.map(dir => new TitaniumModule(dir));
}
