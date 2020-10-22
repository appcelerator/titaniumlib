import fs from 'fs-extra';
import options from '../options';
import path from 'path';
import pluralize from 'pluralize';
import snooplogg from 'snooplogg';
import TitaniumSDK from './titanium-sdk';
import tmp from 'tmp';
import * as request from '@axway/amplify-request';
import { architecture, extractZip, fetchJSON, os, TaskTracker, version } from '../util';
import { arrayify, cacheSync, get, unique } from 'appcd-util';
import { expandPath } from 'appcd-path';
import { getInstallPaths } from '../locations';
import { isDir } from 'appcd-fs';

export { TitaniumSDK };

const { log } = snooplogg;
const { highlight } = snooplogg.styles;

/**
 * A regex to extract a continuous integration build version and platform from the filename.
 * @type {RegExp}
 */
const ciBuildRegExp = /^mobilesdk-(.+)(?:\.v|-)((\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}))-([^.]+)/;

/**
 * A regex to test if a string is a URL or path to a zip file.
 * @type {RegExp}
 */
const uriRegExp = /^(https?:\/\/.+)|(?:file:\/\/(.+))$/;

/**
 * Retrieves the list of CI branches.
 *
 * @returns {Promise<Object>}
 */
export async function getBranches() {
	const results = await fetchJSON(options.sdk.urls.branches);
	results.branches.sort();
	return results;
}

/**
 * Retreives a list of Titanium SDK continuous integration builds.
 *
 * @param {String} [branch="master"] - The branch to retreive.
 * @returns {Promise<Object>} Resolves a map of versions to build info.
 */
export async function getBuilds(branch = 'master') {
	if (!branch || typeof branch !== 'string') {
		throw new TypeError('Expected branch to be a string');
	}

	const { urls } = options.sdk;
	const builds = await fetchJSON(urls.builds.replace(/<BRANCH>/, branch));
	const results = {};

	log(`Received ${pluralize('build', builds.length, true)}`);

	for (const build of builds) {
		const { build_type, filename, git_branch, git_revision } = build;
		const m = filename && filename.match(ciBuildRegExp);

		if (build_type !== 'mobile' || !m || !filename.includes(`-${os}`)) {
			continue;
		}

		const name = `${m[1]}.v${m[2]}`;

		results[name] = {
			version: m[1],
			ts:      m[2],
			githash: git_revision,
			date:    new Date(`${m[3]}-${m.slice(4, 6).join('-')}T${m.slice(6, 9).join(':')}.000Z`),
			url:     urls.build.replace(/<BRANCH>/, git_branch).replace(/<FILENAME>/, filename)
		};
	}

	return results;
}

/**
 * Detects installed Titanium SDKs.
 *
 * @param {Boolean} [force=false] - When `true`, bypasses the cache and redetects the SDKs.
 * @returns {Array.<TitaniumSDK>}
 */
export function getInstalledSDKs(force) {
	return cacheSync('titaniumlib:sdk', force, () => {
		const results = [];

		for (const dir of getPaths()) {
			if (isDir(dir)) {
				for (let sdkDir of fs.readdirSync(dir)) {
					sdkDir = path.join(dir, sdkDir);
					try {
						results.push(new TitaniumSDK(sdkDir));
					} catch (e) {
						// Do nothing
					}
				}
			}
		}

		return results;
	});
}

/**
 * Retreives a map of Titanium SDK versions to release info including the download URL. By default,
 * the latest version is added to the map of releases.
 *
 * @param {Boolean} [noLatest=false] - When `true`, it does not determine the 'latest' release.
 * @returns {Promise<Object>} Resolves a map of versions to URLs.
 */
export async function getReleases(noLatest) {
	const { releases } = await fetchJSON(options.sdk.urls.releases);
	const results = {};
	const is64 = architecture === 'x64';
	const archRE = /64bit/;

	for (const release of releases) {
		const { build_type, name, url, version: ver } = release;

		if (release.os !== os || name !== 'mobilesdk') {
			continue;
		}

		const is64build = archRE.test(build_type);

		if (os !== 'linux' || (is64 && is64build) || (!is64 && !is64build)) {
			results[ver] = {
				name: ver,
				version: ver.replace(/\.GA.*$/, ''),
				url
			};
		}
	}

	if (!noLatest) {
		const latest = Object.keys(results).sort(version.rcompare)[0];
		if (latest) {
			results.latest = results[latest];
		}
	}

	return results;
}

/**
 * Returns a list of possible SDK install paths.
 *
 * @returns {Array.<String>}
 */
export function getPaths() {
	return unique([
		...arrayify(get(options, 'sdk.searchPaths'), true).map(p => expandPath(p)),
		...getInstallPaths().map(p => expandPath(p, 'mobilesdk', os))
	]);
}

/**
 * Install a Titanium SDK from either a URI or version. A URI may be either a local file, a URL, an
 * SDK version, a CI branch, or a CI branch and build hash.
 *
 * @param {Object} [params] - Various parameters.
 * @param {Context} [params.downloadDir] - When `uri` is a URL, release, or build, download the SDK
 * to this directory.
 * @param {String} [params.installDir] - The path to install the SDK. Defaults to the first path in
 * the list of Titanium install locations.
 * @param {Boolean} [params.keep=false] - When `true` and `uri` is a URL, release, or build, and
 * `downloadDir` is specified, then the downloaded SDK `.zip` file is not deleted after install.
 * @param {Function} [params.onProgress] - A callback to fire when install progress is updated.
 * @param {Boolean} [params.overwrite=false] - When `true`, overwrites an existing Titanium SDK
 * installation, otherwise an error is thrown.
 * @param {String} [params.uri] - A URI to a local file or remote URL to download.
 * @returns {Promise<TitaniumSDK>}
 */
export async function install(params = {}) {
	if (!params || typeof params !== 'object') {
		throw new TypeError('Expected params to be an object');
	}

	if (params.uri !== undefined && typeof params.uri !== 'string') {
		throw new TypeError('Expected URI to be a string');
	}

	const tracker = new TaskTracker(params.onProgress, [
		'Extracting SDK',
		'Installing SDK files',
		'Installing module files'
	]);

	const titaniumDir = params.installDir ? expandPath(params.installDir) : getInstallPaths()[0];
	if (!titaniumDir) {
		throw new Error('Unable to determine the Titanium directory');
	}

	let uri            = (params.uri || 'latest').trim();
	const uriMatch     = params.uri && params.uri.match(uriRegExp);
	let downloadedFile = null;
	let file           = null;
	let url            = null;

	// step 1: determine what the uri is

	if (uriMatch && uriMatch[2]) {
		file = uriMatch[2];
	} else if (params.uri && fs.existsSync(params.uri)) {
		file = params.uri;
	}

	if (file) {
		file = expandPath(file);

		if (!fs.existsSync(file)) {
			const err = new Error('Specified file URI does not exist');
			err.code = 'ENOTFOUND';
			throw err;
		}

		if (!/\.zip$/.test(file)) {
			const err = new Error('Specified file URI is not a zip file');
			err.code = 'ENOTFOUND';
			throw err;
		}
	} else {
		// we are downloading an sdk

		tracker.tasks.unshift('Downloading SDK');

		if (uriMatch && uriMatch[1]) {
			// we have a http url
			url = uriMatch[1];
			log(`URI is a URL: ${highlight(url)}`);

		} else {
			let ver = uri;

			tracker.tasks.unshift(`Identifying release "${ver}"`);
			tracker.startTask(false);

			// we have a version that needs to be resolved to a url
			const releases = await getReleases();

			if (ver && (releases[ver] || releases[`${ver}.GA`])) {
				// we have a ga release
				url = (releases[ver] || releases[`${ver}.GA`]).url;
				log(`URI is a release: ${highlight(url)}`);
			} else {
				// maybe a ci build?
				let { branches, defaultBranch } = await getBranches();

				if (ver) {
					const m = ver.match(/^([A-Za-z0-9_]+?):(.+)$/);

					if (m) {
						// uri is a branch:hash combo
						const branch = m[1];
						log(`URI is a branch:hash combo: ${highlight(ver)}`);
						if (!branches.includes(branch)) {
							throw new Error(`Invalid branch "${branch}"`);
						}
						branches = [ branch ];
						ver = m[2];

					} else if (branches.includes(ver)) {
						// uri is a ci branch, default to latest version
						log(`URI is a branch: ${highlight(`${ver}:latest`)}`);
						branches = [ ver ];
						ver = 'latest';
					}
				}

				branches.sort((a, b) => {
					// force the default branch to the front
					return a === defaultBranch ? -1 : b.localeCompare(a);
				});

				if (branches.length > 1) {
					log(`Scanning ${pluralize('branch', branches.length, true)} for ${ver}`);
				}

				let counter = 1;
				const total = branches.length;

				url = await branches.reduce((promise, branch) => {
					return promise.then(async url => {
						if (url) {
							return url;
						}

						const builds = await getBuilds(branch);
						const sortBuilds = (a, b) => {
							const r = version.rcompare(builds[a].version, builds[b].version);
							return r === 0 ? builds[b].ts.localeCompare(builds[a].ts) : r;
						};

						tracker.progress(counter++ / total);

						// eslint-disable-next-line promise/always-return
						for (const name of Object.keys(builds).sort(sortBuilds)) {
							if (ver === 'latest' || name === ver || builds[name].githash === ver) {
								return builds[name].url;
							}
						}
					});
				}, Promise.resolve());
			}

			tracker.endTask();
		}

		if (!url) {
			// note: yes, we want `params.uri` and not `uri`
			const err = new Error(`Unable to find any Titanium SDK releases or CI builds that match "${params.uri}"`);
			err.code = 'ENOTFOUND';
			throw err;
		}

		// step 1.5: download the file

		tracker.startTask();

		let { downloadDir } = params;
		if (downloadDir) {
			downloadedFile = path.join(downloadDir, `titanium-sdk-download-${Date.now()}.zip`);
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
							fs.moveSync(downloadedFile, file, { overwrite: true });
						}
						resolve(file);
					});
					stream.pipe(out);
				});
		});
	}

	// step 2: extract the sdk zip file

	// eslint-disable-next-line security/detect-non-literal-regexp
	const sdkDestRegExp = new RegExp(`^mobilesdk[/\\\\]${os}[/\\\\]([^/\\\\]+)`);
	const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-' });
	let name;
	let dest = null;

	log(`Using Titanium directory: ${highlight(titaniumDir)}`);

	tracker.startTask();

	try {
		await extractZip({
			dest: tempDir,
			file,
			onEntry(filename, idx, total) {
				tracker.progress(idx / total);

				// do a quick check to make sure the destination doesn't exist
				const m = !name && filename.match(sdkDestRegExp);
				if (m) {
					name = m[1];
					const sdkDir = path.join(titaniumDir, 'mobilesdk', os, name);
					if (!params.overwrite && isDir(sdkDir)) {
						throw new Error(`Titanium SDK "${name}" already exists: ${sdkDir}`);
					}
				}
			}
		});

		tracker.endTask();

		if (!name) {
			throw new Error('Zip file does not appear to contain a Titanium SDK');
		}

		// step 3: move the sdk files to the dest

		let src = path.join(tempDir, 'mobilesdk', os, name);
		dest = path.join(titaniumDir, 'mobilesdk', os, name);

		tracker.startTask(false);
		log(`Moving SDK files: ${highlight(src)} => ${highlight(dest)}`);
		await fs.move(src, dest, { overwrite: true });
		tracker.endTask();

		// install the modules

		tracker.startTask();

		const modules = [];
		src = path.join(tempDir, 'modules');
		if (isDir(src)) {
			const modulesDest = path.join(titaniumDir, 'modules');

			for (const platform of fs.readdirSync(src)) {
				const srcPlatformDir = path.join(src, platform);
				if (!isDir(srcPlatformDir)) {
					continue;
				}

				for (const moduleName of fs.readdirSync(srcPlatformDir)) {
					const srcModuleDir = path.join(srcPlatformDir, moduleName);
					if (!isDir(srcModuleDir)) {
						continue;
					}

					for (const ver of fs.readdirSync(srcModuleDir)) {
						const srcVersionDir = path.join(srcModuleDir, ver);
						if (!isDir(srcVersionDir)) {
							continue;
						}

						const destDir = path.join(modulesDest, platform, moduleName, ver);
						const name = `${platform}/${moduleName}@${ver}`;

						if (!params.overwrite && isDir(destDir)) {
							log(`Module ${highlight(`${platform}/${moduleName}@${ver}`)} already exists, skipping`);
							continue;
						}

						modules.push({ name, src: srcVersionDir, dest: destDir });
					}
				}
			}
		}

		const numModules = modules.length;
		if (numModules) {
			let counter = 1;
			for (const { name, src, dest } of modules) {
				log(`Moving module files ${highlight(name)}: ${highlight(src)} => ${highlight(dest)}`);
				await fs.move(src, dest, { overwrite: true });
				tracker.progress(counter++ / numModules);
			}
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

	return new TitaniumSDK(dest);
}

/**
 * Deletes an installed Titanium SDK by name or path.
 *
 * @param {String} nameOrPath - The SDK name or path to uninstall.
 * @returns {Promise<Array<TitaniumSDK>>} Resolves an array of versions removed.
 * @access private
 */
export async function uninstall(nameOrPath) {
	if (!nameOrPath || typeof nameOrPath !== 'string') {
		throw new TypeError('Expected an SDK name or path');
	}

	const sdks = await getInstalledSDKs(true);
	const results = [];

	for (const sdk of sdks) {
		if (sdk.name === nameOrPath || sdk.path === nameOrPath) {
			results.push(sdk);
			log(`Deleting ${highlight(sdk.path)}`);
			await fs.remove(sdk.path);
		}
	}

	if (!results.length) {
		const err = new Error(`Unable to find any SDKs matching "${nameOrPath}"`);
		err.code = 'ENOTFOUND';
		throw err;
	}

	return results;
}
