/* eslint-disable node/prefer-global/url */

import fs from 'fs-extra';
import http from 'http';
import path from 'path';
import tmp from 'tmp';

import { URL } from 'url';
import { sdk, options } from '../dist/index';
import { os } from '../dist/util';

const fixturesDir = path.join(__dirname, 'fixtures');
const { TitaniumSDK } = sdk;

describe('sdk', () => {
	before(async function () {
		this.sdkOpts = JSON.stringify(options.sdk);
		this.searchPaths = JSON.stringify(options.searchPaths);
		this.connections = {};
		this.server = http.createServer((req, res) => {
			const url = new URL(req.url, 'http://127.0.0.1/');

			switch (url.pathname) {
				case '/branches.json':
					res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
					res.end(JSON.stringify({
						defaultBranch: 'master',
						branches: [ 'master', '7_5_X' ]
					}));
					break;

				case '/bad.json':
					res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
					res.end('{{{{');
					break;

				case '/empty.json':
					res.writeHead(200);
					res.end();
					break;

				case '/bad-request':
					res.writeHead(400);
					res.end('Bad request');
					break;

				case '/master/builds.json':
					res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
					res.end(JSON.stringify([
						{
							filename: 'mobilesdk-0.0.0.v20190304080000-linux.zip',
							git_branch: 'master',
							git_revision: 'c67357105b2eeb56a8940cf583f96fe21f94e213',
							build_url: 'https://jenkins.appcelerator.org/job/titanium-sdk/job/titanium_mobile/job/master/109/',
							build_type: 'mobile',
							sha1: '0d401bc0ad521a99863376961d6b6bfc77e45a33',
							size: 142758282
						},
						{
							filename: 'mobilesdk-0.0.0.v20190304080000-osx.zip',
							git_branch: 'master',
							git_revision: 'c67357105b2eeb56a8940cf583f96fe21f94e213',
							build_url: 'https://jenkins.appcelerator.org/job/titanium-sdk/job/titanium_mobile/job/master/109/',
							build_type: 'mobile',
							sha1: '29f7f81d8b689ac804f01141b3cbc4ff72c521a7',
							size: 80156503
						},
						{
							filename: 'mobilesdk-0.0.0.v20190304080000-win32.zip',
							git_branch: 'master',
							git_revision: 'c67357105b2eeb56a8940cf583f96fe21f94e213',
							build_url: 'https://jenkins.appcelerator.org/job/titanium-sdk/job/titanium_mobile/job/master/109/',
							build_type: 'mobile',
							sha1: 'cd78d14cd15b4c6a11c978fdb1372432426ea8b6',
							size: 103506835
						}
					]));
					break;

				case '/7_5_X/builds.json':
					res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
					res.end(JSON.stringify([
						{
							filename: 'mobilesdk-0.0.0.v20190304080000-linux.zip',
							git_branch: '7_5_X',
							git_revision: '2b4c8675ce7eb48dd209c915a95bbe4f6da9c261',
							build_url: '',
							build_type: 'mobile',
							sha1: '',
							size: 142758282
						},
						{
							filename: 'mobilesdk-0.0.0.v20190304080000-osx.zip',
							git_branch: '7_5_X',
							git_revision: '2b4c8675ce7eb48dd209c915a95bbe4f6da9c261',
							build_url: '',
							build_type: 'mobile',
							sha1: '',
							size: 80156503
						},
						{
							filename: 'mobilesdk-0.0.0.v20190304080000-win32.zip',
							git_branch: '7_5_X',
							git_revision: '2b4c8675ce7eb48dd209c915a95bbe4f6da9c261',
							build_url: '',
							build_type: 'mobile',
							sha1: '',
							size: 103506835
						}
					]));
					break;

				case '/releases.json':
					res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
					res.end(JSON.stringify({
						success: true,
						releases: [
							{
								build_type: '10.5_i386',
								name: 'mobilesdk',
								guid: 'C5A13520-E091-4CEA-BFC3-AE453D23238D',
								version: '7.5.1.GA',
								os: 'osx',
								url: 'http://127.0.0.1:1337/mock-sdk.zip',
								checksum: '246a0e6209fc2b245953244beefde14f783098cd',
								children: null
							},
							{
								build_type: '64bit_i386',
								name: 'mobilesdk',
								guid: 'C5A13520-E091-4CEA-BFC3-AE453D23238D',
								version: '7.5.1.GA',
								os: 'linux',
								url: 'http://127.0.0.1:1337/mock-sdk.zip',
								checksum: '27f604584a2e116bb9ba1771f772bfb84d0ab34b',
								children: null
							},
							{
								build_type: '32bit_i386',
								name: 'mobilesdk',
								guid: 'C5A13520-E091-4CEA-BFC3-AE453D23238D',
								version: '7.5.1.GA',
								os: 'linux',
								url: 'http://127.0.0.1:1337/mock-sdk.zip',
								checksum: '27f604584a2e116bb9ba1771f772bfb84d0ab34b',
								children: null
							},
							{
								build_type: 'win32',
								name: 'mobilesdk',
								guid: 'C5A13520-E091-4CEA-BFC3-AE453D23238D',
								version: '7.5.1.GA',
								os: 'win32',
								url: 'http://127.0.0.1:1337/mock-sdk.zip',
								checksum: '19b2052beb9d6648a8e93fb6f599e2da1616b5b2',
								children: null
							}
						]
					}));
					break;

				case '/mock-sdk.zip':
				case '/7_5_X/mobilesdk-0.0.0.v20190304080000-linux.zip':
				case '/7_5_X/mobilesdk-0.0.0.v20190304080000-osx.zip':
				case '/7_5_X/mobilesdk-0.0.0.v20190304080000-win32.zip':
				case '/master/mobilesdk-0.0.0.v20190304080000-linux.zip':
				case '/master/mobilesdk-0.0.0.v20190304080000-osx.zip':
				case '/master/mobilesdk-0.0.0.v20190304080000-win32.zip':
					const m = url.pathname.match(/^.*\/(.+)$/);
					const file = path.resolve(__dirname, 'fixtures', m[1]);
					res.writeHead(200, {
						'Content-Type': 'application/octet-stream',
						'Content-Length': fs.statSync(file).size
					});
					fs.createReadStream(file).pipe(res);
					break;

				default:
					res.writeHead(404, { 'Content-Type': 'text/plain' });
					res.end('Not Found');
			}
		});

		await new Promise((resolve, reject) => {
			this.server
				.on('listening', resolve)
				.on('connection', conn => {
					const key = `${conn.remoteAddress}:${conn.remotePort}`;
					this.connections[key] = conn;
					conn.on('close', () => {
						delete this.connections[key];
					});
				})
				.on('error', reject)
				.listen(1337, '127.0.0.1');
		});
	});

	after(async function () {
		options.sdk = JSON.parse(this.sdkOpts);
		options.searchPaths = JSON.parse(this.searchPaths);
		await new Promise(resolve => this.server.close(resolve));
		for (const conn of Object.values(this.connections)) {
			conn.destroy();
		}
	});

	beforeEach(function () {
		process.env.TITANIUMLIB_PLATFORM = 'test';
		options.sdk = JSON.parse(this.sdkOpts);
		options.searchPaths = JSON.parse(this.searchPaths);
	});

	afterEach(() => {
		delete process.env.TITANIUMLIB_PLATFORM;
	});

	describe('TitaniumSDK', () => {
		it('should error if directory is invalid', () => {
			expect(() => {
				new TitaniumSDK();
			}).to.throw(TypeError, 'Expected Titanium SDK directory to be a non-empty string');

			expect(() => {
				new TitaniumSDK(123);
			}).to.throw(TypeError, 'Expected Titanium SDK directory to be a non-empty string');

			expect(() => {
				new TitaniumSDK('');
			}).to.throw(TypeError, 'Expected Titanium SDK directory to be a non-empty string');
		});

		it('should error if directory does not exist', () => {
			const dir = path.join(__dirname, 'doesnotexist');
			expect(() => {
				new TitaniumSDK(dir);
			}).to.throw(Error, `Specified Titanium SDK directory does not exist: ${dir}`);
		});

		it('should error if directory has no manifest', () => {
			expect(() => {
				new TitaniumSDK(path.join(fixturesDir, 'empty'));
			}).to.throw(Error, 'Invalid Titanium SDK: No manifest.json found');
		});

		it('should error if directory has no package.json', () => {
			expect(() => {
				new TitaniumSDK(path.join(fixturesDir, 'sdk', 'manifestonly'));
			}).to.throw(Error, 'Invalid Titanium SDK: No package.json found');
		});

		it('should error if manifest is not an object', () => {
			expect(() => {
				new TitaniumSDK(path.join(fixturesDir, 'sdk', 'manifestisarray'));
			}).to.throw(Error, 'Directory does not contain a valid manifest');

			expect(() => {
				new TitaniumSDK(path.join(fixturesDir, 'sdk', 'manifestisstring'));
			}).to.throw(Error, 'Directory does not contain a valid manifest');

			expect(() => {
				new TitaniumSDK(path.join(fixturesDir, 'sdk', 'manifestisnumber'));
			}).to.throw(Error, 'Directory does not contain a valid manifest');
		});

		it('should read a good sdk', () => {
			const sdkPath = path.join(fixturesDir, 'sdk', 'good');
			const sdkInfo = new TitaniumSDK(sdkPath);
			expect(sdkInfo).to.deep.equal({
				name: 'good',
				package: {
					name: 'titanium-mobile',
					description: 'Appcelerator Titanium Mobile',
					version: '9.0.3',
					moduleApiVersion: {
						iphone: '2',
						android: '4'
					},
					keywords: [
						'appcelerator',
						'titanium',
						'mobile',
						'android',
						'iphone',
						'ipad',
						'ios'
					]
				},
				manifest: {
					name: '7.0.2.v20180209105903',
					version: '7.0.2',
					moduleAPIVersion: { iphone: '2', android: '4', windows: '4' },
					timestamp: '2/9/2018 19:05',
					githash: '5ef0c56',
					platforms: [
						'iphone',
						'android'
					]
				},
				path: sdkPath
			});
		});
	});

	describe('getBranches()', () => {
		it('should get the list of branches (production)', async function () {
			this.slow(9000);
			this.timeout(10000);

			const branches = await sdk.getBranches();
			expect(branches).to.be.an('object');
			expect(branches).to.have.all.keys('defaultBranch', 'branches');
			expect(branches.branches).to.be.an('array');
			expect(branches.branches).to.have.lengthOf.at.least(1);
		});

		it('should get the list of branches (local)', async () => {
			options.sdk.urls.branches = 'http://localhost:1337/branches.json';
			const branches = await sdk.getBranches();
			expect(branches).to.be.an('object');
			expect(branches).to.deep.equal({
				branches: [ '7_5_X', 'master' ],
				defaultBranch: 'master'
			});
		});

		it('should error if server cannot be resolved', async function () {
			this.slow(9000);
			this.timeout(10000);

			options.sdk.urls.branches = 'http://does_not_exist';

			try {
				await sdk.getBranches();
			} catch (e) {
				expect(e).to.be.instanceOf(Error);
				expect(e.message).to.match(/ENOTFOUND|EAI_AGAIN/);
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if response is empty', async () => {
			options.sdk.urls.branches = 'http://localhost:1337/empty.json';

			try {
				await sdk.getBranches();
			} catch (e) {
				expect(e).to.be.instanceOf(Error);
				expect(e.message).to.match(/unexpected end of JSON input/i);
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if response is not valid json', async () => {
			options.sdk.urls.branches = 'http://localhost:1337/bad.json';

			try {
				await sdk.getBranches();
			} catch (e) {
				expect(e).to.be.instanceOf(Error);
				expect(e.message).to.match(/unexpected token {/i);
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if request is bad', async () => {
			options.sdk.urls.branches = 'http://localhost:1337/bad-request';

			try {
				await sdk.getBranches();
			} catch (e) {
				expect(e).to.be.instanceOf(Error);
				expect(e.message).to.equal('Response code 400 (Bad Request)');
				return;
			}

			throw new Error('Expected error');
		});
	});

	describe('getBuilds()', () => {
		it('should get a list of master branch builds (production)', async function () {
			this.timeout(20000);
			this.slow(19000);

			let builds = await sdk.getBuilds();
			expect(builds).to.be.an('object');

			let build = builds[Object.keys(builds)[0]];
			expect(build).to.have.all.keys('version', 'ts', 'githash', 'date', 'url');

			builds = await sdk.getBuilds();
			expect(builds).to.be.an('object');

			build = builds[Object.keys(builds)[0]];
			expect(build).to.have.all.keys('version', 'ts', 'githash', 'date', 'url');
		});

		it('should get a list of master branch builds (local)', async function () {
			this.timeout(5000);
			this.slow(4000);

			options.sdk.urls.builds = 'http://localhost:1337/<BRANCH>/builds.json';
			options.sdk.urls.build = 'http://localhost:1337/<BRANCH>/<FILENAME>';

			const builds = await sdk.getBuilds();
			expect(builds).to.be.an('object');
			expect(builds).to.deep.equal({
				'0.0.0.v20190304080000': {
					version: '0.0.0',
					ts: '20190304080000',
					githash: 'c67357105b2eeb56a8940cf583f96fe21f94e213',
					date: new Date('2019-03-04T08:00:00.000Z'),
					url: `http://localhost:1337/master/mobilesdk-0.0.0.v20190304080000-${os}.zip`
				}
			});
		});

		it('should get a list of 8_0_X branch builds', async function () {
			this.timeout(10000);
			this.slow(9000);

			const builds = await sdk.getBuilds('8_0_X');
			expect(builds).to.be.an('object');

			const build = builds[Object.keys(builds)[0]];
			expect(build).to.have.all.keys('version', 'ts', 'githash', 'date', 'url');
		});

		it('should error if branch is not a string', async () => {
			try {
				await sdk.getBuilds(123);
			} catch (e) {
				expect(e).to.be.instanceOf(TypeError);
				expect(e.message).to.equal('Expected branch to be a string');
				return;
			}
			throw new Error('Expected error');
		});
	});

	describe('getReleases()', () => {
		it('should get a list of releases (production)', async function () {
			this.slow(9000);
			this.timeout(10000);

			const releases = await sdk.getReleases();
			expect(releases).to.be.an('object');

			expect(releases).to.have.property('latest');
			expect(releases.latest).to.be.an('object');
			expect(releases.latest).to.have.all.keys('version', 'url', 'name');

			const release = releases[Object.keys(releases)[0]];
			expect(release).to.be.an('object');
			expect(release).to.have.all.keys('version', 'url', 'name');
		});

		it('should get a list of releases (local)', async () => {
			options.sdk.urls.releases = 'http://localhost:1337/releases.json';

			const releases = await sdk.getReleases();
			expect(releases).to.be.an('object');
			expect(releases).to.deep.equal({
				'7.5.1.GA': {
					name: '7.5.1.GA',
					url: 'http://127.0.0.1:1337/mock-sdk.zip',
					version: '7.5.1'
				},
				latest: {
					name: '7.5.1.GA',
					url: 'http://127.0.0.1:1337/mock-sdk.zip',
					version: '7.5.1'
				}
			});
		});

		it('should get a list of releases without latest (local)', async () => {
			options.sdk.urls.releases = 'http://localhost:1337/releases.json';

			const releases = await sdk.getReleases(true);
			expect(releases).to.be.an('object');
			expect(releases).to.deep.equal({
				'7.5.1.GA': {
					name: '7.5.1.GA',
					url: 'http://127.0.0.1:1337/mock-sdk.zip',
					version: '7.5.1'
				}
			});
		});
	});

	describe('getInstalledSDKs()', () => {
		it('should detect sdks', () => {
			options.sdk.searchPaths = path.join(fixturesDir, 'sdk');
			const sdks = sdk.getInstalledSDKs(true);
			expect(sdks).to.deep.equal([
				{
					name: 'good',
					manifest: {
						name: '7.0.2.v20180209105903',
						version: '7.0.2',
						moduleAPIVersion: { iphone: '2', android: '4', windows: '4' },
						timestamp: '2/9/2018 19:05',
						githash: '5ef0c56',
						platforms: [
							'iphone',
							'android'
						]
					},
					package: {
						name: 'titanium-mobile',
						description: 'Appcelerator Titanium Mobile',
						version: '9.0.3',
						moduleApiVersion: {
							iphone: '2',
							android: '4'
						},
						keywords: [
							'appcelerator',
							'titanium',
							'mobile',
							'android',
							'iphone',
							'ipad',
							'ios'
						]
					},
					path: path.join(fixturesDir, 'sdk', 'good')
				}
			]);
		});

		it('should detect sdks on the system', () => {
			const sdks = sdk.getInstalledSDKs(true);
			expect(sdks).to.be.an('array');
		});
	});

	describe('install()', () => {
		it('should error if params is not an object', async () => {
			try {
				await sdk.install(123);
			} catch (e) {
				expect(e).to.be.instanceOf(TypeError);
				expect(e.message).to.equal('Expected params to be an object');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if URI is not a string', async () => {
			try {
				await sdk.install({
					uri: 123
				});
			} catch (e) {
				expect(e).to.be.instanceOf(TypeError);
				expect(e.message).to.equal('Expected URI to be a string');
				return;
			}

			throw new Error('Expected error');
		});

		it('should fail if local file does not exist', async () => {
			try {
				const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
				await sdk.install({
					installDir: tempDir,
					uri: `file://${path.resolve(__dirname, 'does_not_exist')}`
				});
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Specified file URI does not exist');
				return;
			}

			throw new Error('Expected error');
		});

		it('should fail if local file is not a zip file extension', async () => {
			try {
				const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
				await sdk.install({
					installDir: tempDir,
					uri: path.resolve(__dirname, 'fixtures', 'empty.txt')
				});
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Specified file URI is not a zip file');
				return;
			}

			throw new Error('Expected error');
		});

		it('should fail if local file is not a valid zip file', async () => {
			try {
				const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
				await sdk.install({
					installDir: tempDir,
					uri: path.resolve(__dirname, 'fixtures', 'not-a-zip.zip')
				});
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Invalid zip file: end of central directory record signature not found');
				return;
			}

			throw new Error('Expected error');
		});

		it('should fail if zip file does not contain an SDK', async () => {
			try {
				const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
				await sdk.install({
					installDir: tempDir,
					uri: path.resolve(__dirname, 'fixtures', 'not-an-sdk.zip')
				});
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Zip file does not appear to contain a Titanium SDK');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if Titanium directory is not defined', async () => {
			try {
				await sdk.install({
					uri: path.resolve(__dirname, 'fixtures', 'mock-sdk.zip')
				});
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Unable to determine the Titanium directory');
				return;
			}

			throw new Error('Expected error');
		});

		it('should install an SDK from local file', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });

			try {
				options.searchPaths = tempDir;

				await sdk.install({
					installDir: tempDir,
					uri: path.resolve(__dirname, 'fixtures', 'mock-sdk.zip')
				});

				const sdkDir = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA');
				const sdks = sdk.getInstalledSDKs(true);
				expect(sdks).to.be.an('array');
				expect(sdks).to.have.lengthOf(1);
				expect(sdks[0]).to.deep.equal({
					name: '0.0.0.GA',
					manifest: {
						name: '0.0.0.GA',
						version: '0.0.0',
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '6'
						},
						githash: '1234567890',
						platforms: [ 'android' ]
					},
					package: {
						description: 'Appcelerator Titanium Mobile',
						keywords: [
							'appcelerator',
							'titanium',
							'mobile',
							'android',
							'iphone',
							'ipad',
							'ios'
						],
						moduleApiVersion: {
							android: '4',
							iphone: '2'
						},
						name: 'titanium-mobile',
						version: '0.0.0'
					},
					path: sdkDir
				});

				try {
					await sdk.install({
						installDir: tempDir,
						uri: path.resolve(__dirname, 'fixtures', 'mock-sdk.zip')
					});
				} catch (e) {
					expect(e).to.be.instanceOf(Error);
					expect(e.message).to.equal(`Titanium SDK "0.0.0.GA" already exists: ${sdkDir}`);

					await sdk.install({
						installDir: tempDir,
						overwrite: true,
						uri: path.resolve(__dirname, 'fixtures', 'mock-sdk.zip')
					});

					const sdks = sdk.getInstalledSDKs(true);
					expect(sdks).to.be.an('array');
					expect(sdks).to.have.lengthOf(1);

					return;
				}

				throw new Error('Expected error');
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('should not overwrite a module', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });

			try {
				options.searchPaths = tempDir;

				await sdk.install({
					installDir: tempDir,
					uri: path.resolve(__dirname, 'fixtures', 'mock-sdk.zip')
				});

				await fs.remove(path.join(tempDir, 'mobilesdk'));

				const manifestFile = path.join(tempDir, 'modules', 'commonjs', 'testmodule', '1.0.0', 'manifest');
				expect(fs.existsSync(manifestFile)).to.be.true;

				fs.appendFileSync(manifestFile, 'foobar');

				await sdk.install({
					installDir: tempDir,
					uri: path.resolve(__dirname, 'fixtures', 'mock-sdk.zip')
				});

				expect(fs.readFileSync(manifestFile).toString()).to.have.string('foobar');
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('should download a SDK with a URL', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;

				await sdk.install({
					installDir: tempDir,
					uri: 'http://127.0.0.1:1337/mock-sdk.zip'
				});

				const sdkDir = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA');
				const sdks = sdk.getInstalledSDKs(true);
				expect(sdks).to.be.an('array');
				expect(sdks).to.have.lengthOf(1);
				expect(sdks[0]).to.deep.equal({
					name: '0.0.0.GA',
					manifest: {
						name: '0.0.0.GA',
						version: '0.0.0',
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '6'
						},
						githash: '1234567890',
						platforms: [ 'android' ]
					},
					package: {
						description: 'Appcelerator Titanium Mobile',
						keywords: [
							'appcelerator',
							'titanium',
							'mobile',
							'android',
							'iphone',
							'ipad',
							'ios'
						],
						moduleApiVersion: {
							android: '4',
							iphone: '2'
						},
						name: 'titanium-mobile',
						version: '0.0.0'
					},
					path: sdkDir
				});
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('should error if URL 404s', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;

				await sdk.install({
					installDir: tempDir,
					uri: 'http://127.0.0.1:1337/not_found'
				});
			} catch (e) {
				expect(e).to.be.instanceOf(Error);
				expect(e.message).to.equal('Response code 404 (Not Found)');
				return;
			} finally {
				await fs.remove(tempDir);
			}

			throw new Error('Expected error');
		});

		it('should download the latest release', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;
				options.sdk.urls.releases = 'http://127.0.0.1:1337/releases.json';

				await sdk.install({
					installDir: tempDir
				});

				const sdkDir = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA');
				const sdks = sdk.getInstalledSDKs(true);
				expect(sdks).to.be.an('array');
				expect(sdks).to.have.lengthOf(1);
				expect(sdks[0]).to.deep.equal({
					name: '0.0.0.GA',
					manifest: {
						name: '0.0.0.GA',
						version: '0.0.0',
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '6'
						},
						githash: '1234567890',
						platforms: [ 'android' ]
					},
					package: {
						description: 'Appcelerator Titanium Mobile',
						keywords: [
							'appcelerator',
							'titanium',
							'mobile',
							'android',
							'iphone',
							'ipad',
							'ios'
						],
						moduleApiVersion: {
							android: '4',
							iphone: '2'
						},
						name: 'titanium-mobile',
						version: '0.0.0'
					},
					path: sdkDir
				});
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('should download a specific release version', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;
				options.sdk.urls.releases = 'http://127.0.0.1:1337/releases.json';

				await sdk.install({
					installDir: tempDir,
					uri: '7.5.1'
				});

				const sdkDir = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA');
				const sdks = sdk.getInstalledSDKs(true);
				expect(sdks).to.be.an('array');
				expect(sdks).to.have.lengthOf(1);
				expect(sdks[0]).to.deep.equal({
					name: '0.0.0.GA',
					manifest: {
						name: '0.0.0.GA',
						version: '0.0.0',
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '6'
						},
						githash: '1234567890',
						platforms: [ 'android' ]
					},
					package: {
						description: 'Appcelerator Titanium Mobile',
						keywords: [
							'appcelerator',
							'titanium',
							'mobile',
							'android',
							'iphone',
							'ipad',
							'ios'
						],
						moduleApiVersion: {
							android: '4',
							iphone: '2'
						},
						name: 'titanium-mobile',
						version: '0.0.0'
					},
					path: sdkDir
				});
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('should download a specific release version by uri', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;
				options.sdk.urls.releases = 'http://127.0.0.1:1337/releases.json';

				await sdk.install({
					installDir: tempDir,
					uri: '7.5.1.GA'
				});

				const sdkDir = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA');
				const sdks = sdk.getInstalledSDKs(true);
				expect(sdks).to.be.an('array');
				expect(sdks).to.have.lengthOf(1);
				expect(sdks[0]).to.deep.equal({
					name: '0.0.0.GA',
					manifest: {
						name: '0.0.0.GA',
						version: '0.0.0',
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '6'
						},
						githash: '1234567890',
						platforms: [ 'android' ]
					},
					package: {
						description: 'Appcelerator Titanium Mobile',
						keywords: [
							'appcelerator',
							'titanium',
							'mobile',
							'android',
							'iphone',
							'ipad',
							'ios'
						],
						moduleApiVersion: {
							android: '4',
							iphone: '2'
						},
						name: 'titanium-mobile',
						version: '0.0.0'
					},
					path: sdkDir
				});
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('should download a build by branch and hash', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;
				options.sdk.urls.releases = 'http://127.0.0.1:1337/releases.json';
				options.sdk.urls.branches = 'http://127.0.0.1:1337/branches.json';
				options.sdk.urls.builds = 'http://localhost:1337/<BRANCH>/builds.json';
				options.sdk.urls.build = 'http://localhost:1337/<BRANCH>/<FILENAME>';

				await sdk.install({
					installDir: tempDir,
					uri: '7_5_X:2b4c8675ce7eb48dd209c915a95bbe4f6da9c261'
				});

				const sdkDir = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA');
				const sdks = sdk.getInstalledSDKs(true);
				expect(sdks).to.be.an('array');
				expect(sdks).to.have.lengthOf(1);
				expect(sdks[0]).to.deep.equal({
					name: '0.0.0.GA',
					manifest: {
						name: '0.0.0.GA',
						version: '0.0.0',
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '6'
						},
						githash: '1234567890',
						platforms: [ 'android', 'iphone' ]
					},
					package: {
						description: 'Appcelerator Titanium Mobile',
						keywords: [
							'appcelerator',
							'titanium',
							'mobile',
							'android',
							'iphone',
							'ipad',
							'ios'
						],
						moduleApiVersion: {
							android: '4',
							iphone: '2'
						},
						name: 'titanium-mobile',
						version: '0.0.0'
					},
					path: sdkDir
				});
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('should error if branch is invalid', async function () {
			this.slow(9000);
			this.timeout(10000);

			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;
				options.sdk.urls.releases = 'http://127.0.0.1:1337/releases.json';
				options.sdk.urls.builds = 'http://localhost:1337/<BRANCH>/builds.json';
				options.sdk.urls.build = 'http://localhost:1337/<BRANCH>/<FILENAME>';

				await sdk.install({
					installDir: tempDir,
					uri: 'foo:bar'
				});
			} catch (e) {
				expect(e).to.be.instanceOf(Error);
				expect(e.message).to.equal('Invalid branch "foo"');
				return;
			} finally {
				await fs.remove(tempDir);
			}

			throw new Error('Expected error');
		});

		it('should download a build by branch', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;
				options.sdk.urls.releases = 'http://127.0.0.1:1337/releases.json';
				options.sdk.urls.branches = 'http://127.0.0.1:1337/branches.json';
				options.sdk.urls.builds = 'http://localhost:1337/<BRANCH>/builds.json';
				options.sdk.urls.build = 'http://localhost:1337/<BRANCH>/<FILENAME>';

				await sdk.install({
					installDir: tempDir,
					uri: '7_5_X'
				});

				const sdkDir = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA');
				const sdks = sdk.getInstalledSDKs(true);
				expect(sdks).to.be.an('array');
				expect(sdks).to.have.lengthOf(1);
				expect(sdks[0]).to.deep.equal({
					name: '0.0.0.GA',
					manifest: {
						name: '0.0.0.GA',
						version: '0.0.0',
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '6'
						},
						githash: '1234567890',
						platforms: [ 'android', 'iphone' ]
					},
					package: {
						description: 'Appcelerator Titanium Mobile',
						keywords: [
							'appcelerator',
							'titanium',
							'mobile',
							'android',
							'iphone',
							'ipad',
							'ios'
						],
						moduleApiVersion: {
							android: '4',
							iphone: '2'
						},
						name: 'titanium-mobile',
						version: '0.0.0'
					},
					path: sdkDir
				});
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('should download a build by hash', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;
				options.sdk.urls.releases = 'http://127.0.0.1:1337/releases.json';
				options.sdk.urls.branches = 'http://127.0.0.1:1337/branches.json';
				options.sdk.urls.builds = 'http://localhost:1337/<BRANCH>/builds.json';
				options.sdk.urls.build = 'http://localhost:1337/<BRANCH>/<FILENAME>';

				await sdk.install({
					installDir: tempDir,
					uri: '2b4c8675ce7eb48dd209c915a95bbe4f6da9c261'
				});

				const sdkDir = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA');
				const sdks = sdk.getInstalledSDKs(true);
				expect(sdks).to.be.an('array');
				expect(sdks).to.have.lengthOf(1);
				expect(sdks[0]).to.deep.equal({
					name: '0.0.0.GA',
					manifest: {
						name: '0.0.0.GA',
						version: '0.0.0',
						moduleAPIVersion: {
							iphone: '2',
							android: '4',
							windows: '6'
						},
						githash: '1234567890',
						platforms: [ 'android', 'iphone' ]
					},
					package: {
						description: 'Appcelerator Titanium Mobile',
						keywords: [
							'appcelerator',
							'titanium',
							'mobile',
							'android',
							'iphone',
							'ipad',
							'ios'
						],
						moduleApiVersion: {
							android: '4',
							iphone: '2'
						},
						name: 'titanium-mobile',
						version: '0.0.0'
					},
					path: sdkDir
				});
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('should error if URI is not resolvable', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;
				options.sdk.urls.releases = 'http://127.0.0.1:1337/releases.json';
				options.sdk.urls.branches = 'http://127.0.0.1:1337/branches.json';
				options.sdk.urls.builds = 'http://localhost:1337/<BRANCH>/builds.json';
				options.sdk.urls.build = 'http://localhost:1337/<BRANCH>/<FILENAME>';

				await sdk.install({
					installDir: tempDir,
					uri: 'foobar'
				});
			} catch (e) {
				expect(e).to.be.instanceOf(Error);
				expect(e.message).to.equal('Unable to find any Titanium SDK releases or CI builds that match "foobar"');
				return;
			} finally {
				await fs.remove(tempDir);
			}

			throw new Error('Expected error');
		});

		(os === 'win32' ? it.skip : it)('should preserve permissions on files', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });
			try {
				options.searchPaths = tempDir;

				await sdk.install({
					installDir: tempDir,
					uri: 'http://127.0.0.1:1337/mock-sdk.zip'
				});

				const executableLocation = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA', 'executable');
				expect(() => {
					fs.accessSync(executableLocation, fs.constants.X_OK);
				}).to.not.throw();
			} finally {
				await fs.remove(tempDir);
			}
		});
	});

	describe('uninstall()', () => {
		it('should error if name and path not specified', async () => {
			try {
				await sdk.uninstall();
			} catch (e) {
				expect(e).to.be.instanceOf(TypeError);
				expect(e.message).to.equal('Expected an SDK name or path');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if sdk not found', async () => {
			try {
				await sdk.uninstall('does_not_exist');
			} catch (e) {
				expect(e).to.be.instanceOf(Error);
				expect(e.message).to.equal('Unable to find any SDKs matching "does_not_exist"');
				return;
			}

			throw new Error('Expected error');
		});

		it('should uninstall by name', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });

			try {
				options.searchPaths = tempDir;

				await sdk.install({
					installDir: tempDir,
					uri: path.resolve(__dirname, 'fixtures', 'mock-sdk.zip')
				});

				const sdkDir = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA');
				const sdks = sdk.getInstalledSDKs(true);
				const results = await sdk.uninstall(sdks[0].name);

				expect(results).to.have.lengthOf(1);
				expect(results[0].name).to.equal('0.0.0.GA');
				expect(results[0].path).to.equal(sdkDir);
				expect(fs.existsSync(sdkDir)).to.be.false;
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('should uninstall by path', async () => {
			const tempDir = tmp.tmpNameSync({ prefix: 'titaniumlib-test-' });

			try {
				options.searchPaths = tempDir;

				await sdk.install({
					installDir: tempDir,
					uri: path.resolve(__dirname, 'fixtures', 'mock-sdk.zip')
				});

				const sdkDir = path.join(tempDir, 'mobilesdk', os, '0.0.0.GA');
				const sdks = sdk.getInstalledSDKs(true);
				const results = await sdk.uninstall(sdks[0].path);

				expect(results).to.have.lengthOf(1);
				expect(results[0].name).to.equal('0.0.0.GA');
				expect(results[0].path).to.equal(sdkDir);
				expect(fs.existsSync(sdkDir)).to.be.false;
			} finally {
				await fs.remove(tempDir);
			}
		});
	});
});
