/* eslint-disable quote-props */

import Config, { Joi } from 'config-kit';
// import XMLStore from 'config-kit-xml';

/**
 * The tiapp schema.
 * @type {Joi}
 */
export const schema = Joi.object({
	// general app info
	'id': Joi.string()
		.description('The application ID.')
		.required(),

	'name': Joi.string()
		.description('The application name.')
		.required(),

	'guid': Joi.string()
		.description('A unique ID that associates this application with the Axway platform for analytics and other services.')
		.required()
		.guid(),

	'version': Joi.string()
		.description('The application version.'),

	'description': Joi.string()
		.description('The description of this application.'),

	'copyright': Joi.string()
		.description('The copyright of this application.'),

	'publisher': Joi.string(),

	'url': Joi.string()
		.description('The URL of this application.'),

	// app configuration
	'analytics': Joi.boolean()
		.description('Whether or not to automatically collect analytics for this application.')
		.default(true),

	'icon': Joi.string()
		.description('The application icon\'s filename.'),

	'fullscreen': Joi.boolean()
		.description('Whether or not the application will start by taking up the entire screen')
		.default(false),

	'navbarHidden': Joi.boolean()
		.description('Whether or not the navigation bar is hidden for this application.')
		.default(false)
		.meta({ tag: 'navbar-hidden' }),

	'persistentWifi': Joi.boolean()
		.meta({ tag: 'persistent-wifi' }),

	'prerenderedIcon': Joi.boolean()
		.meta({ tag: 'prerendered-icon' }),

	'sdkVersion': Joi.string()
		.meta({ tag: 'sdk-version' }),

	'sourceMaps': Joi.boolean()
		.meta({ tag: 'source-maps' }),

	'statusbarHidden': Joi.boolean()
		.description('For Android only, set to "true" to set the theme to "Theme.AppCompat.NoTitleBar.Fullscreen".')
		.default(false)
		.meta({ tag: 'statusbar-hidden' }),

	'statusbarStyle': Joi.string()
		.meta({ tag: 'statusbar-style' }),

	'transpile': Joi.boolean(),

	'deploymentTargets': Joi.object()
		.description('This element contains subelements of deployment targets used by Studio to determine which target options should be shown in the deployment menus.')
		.pattern(
			Joi.string()
				.valid('android', 'ipad', 'iphone', 'windows')
				.meta({ child: 'target', value: '@device' }),
			Joi.boolean()
		)
		.meta({ tag: 'deployment-targets' }),

	'properties': Joi.object()
		.pattern(
			Joi.string()
				.meta({ value: '@name' }),
			Joi.object({
				type: Joi.string()
					.valid('bool', 'double', 'int', 'string')
					.meta({ value: '@type' }),
				value: Joi.alternatives()
					.try(
						Joi.string(),
						Joi.boolean()
					)
					.meta({ single: true })
			})
		)
		.meta({ tag: 'property' }),

	'android': Joi.string()
		.meta({ oblock: true }),

	'ios': Joi.object({
		'teamId': Joi.string()
			.when('extensions', {
				is:   Joi.exist(),
				then: Joi.required()
			})
			.meta({ tag: 'team-id' }),

		'entitlements': Joi.string()
			.meta({ block: true }),

		'extensions': Joi.array()
			.items(
				Joi.object({
					'projectPath': Joi.string()
						.meta({ value: '@projectPath' }),
					'targets': Joi.object()
						.pattern(
							Joi.string()
								.required()
								.meta({ value: '@name' }),
							Joi.object({
								'provisioningProfiles': Joi.object({
									'device': Joi.string(),
									'distAppstore': Joi.string().meta({ tag: 'dist-appstore' }),
									'distAdhoc': Joi.string().meta({ tag: 'dist-adhoc' })
								}).meta({ tag: 'provisioning-profiles' })
							})
						)
						.meta({ tag: 'target' })
				})
			)
			.meta({ child: 'extension' }),

		'plist': Joi.string()
			.meta({ block: true }),

		'defaultBackgroundColor': Joi.string()
			.meta({ tag: 'default-background-color' }),

		'enableLaunchScreenStoryboard': Joi.boolean()
			.meta({ tag: 'enable-launch-screen-storyboard' }),

		'enablecoverage': Joi.boolean(),

		'enablemdfind': Joi.boolean(),

		'logServerPort': Joi.number()
			.meta({ tag: 'log-server-port' }),

		'minIosVer': Joi.string()
			.meta({ tag: 'min-ios-ver' }),

		'useAppThinning': Joi.boolean()
			.meta({ tag: 'use-app-thinning' }),

		'useAutolayout': Joi.boolean()
			.meta({ tag: 'use-autolayout' }),

		'useJscoreFramework': Joi.boolean()
			.meta({ tag: 'use-jscore-framework' }),

		'capabilities': Joi.object({
			'appGroups': Joi.array()
				.items(
					Joi.string()
				)
				.meta({ child: 'group', tag: 'app-groups' })
		})
	}),

	'iphone': Joi.object({
		'orientations': Joi.object()
			.pattern(
				Joi.string()
					.meta({ value: '@device' }),
				Joi.array()
					.items(Joi.string())
					.meta({ child: 'orientation' })
			),

		'background': Joi.array()
			.items(Joi.string())
			.meta({ child: 'mode' }),

		'requires': Joi.array()
			.items(Joi.string())
			.meta({ child: 'feature' }),

		'types': Joi.array()
			.items(Joi.object({
				'name': Joi.string(),
				'icon': Joi.string(),
				'uti': Joi.string(),
				'owner': Joi.boolean()
			}))
			.meta({ child: 'type' })
	}),

	'windows': Joi.object({
		'id': Joi.string(),

		'TargetPlatformVersion': Joi.string(),

		'TargetPlatformMinVersion': Joi.string(),

		'useAutoVersioning': Joi.boolean()
			.meta({ tag: 'use-auto-versioning' }),

		'manifest': Joi.object()
			.pattern(
				Joi.string()
					.meta({ value: '@target' }),
				Joi.string()
					.meta({ block: true })
			)
	}),

	'modules': Joi.array()
		.items(
			Joi.object({
				'name': Joi.string()
					.meta({ single: true }),

				'version': Joi.string()
					.meta({ value: '@version' }),

				'platforms': Joi.alternatives()
					.try(
						Joi.string(),
						Joi.array().items(Joi.string())
					)
					.meta({ split: ',', value: '@platform' }),

				'deployTypes': Joi.alternatives()
					.try(
						Joi.string().valid('development', 'test', 'production'),
						Joi.array().items(Joi.string())
					)
					.meta({
						selectItem(items) {
							for (const item of items) {
								if (item.type === 'array') {
									return item;
								}
							}
						},
						split: ',',
						value: '@deploy-type'
					})
			}),
			Joi.string()
		)
		.meta({
			child: 'module',
			selectItem(items) {
				let selected;
				for (const item of items) {
					if (item.type !== 'object') {
						selected = item;
					} else if (item.value.version || item.value.platforms || item.value.deployTypes) {
						return item;
					}
				}
				return selected;
			}
		}),

	'plugins': Joi.array()
		.items(
			Joi.object({
				'name': Joi.string()
					.meta({ single: true }),
				'version': Joi.string()
					.meta({ value: '@version' })
			}),
			Joi.string()
		)
		.meta({
			child: 'plugin',
			selectItem(items) {
				let selected;
				for (const item of items) {
					if (item.type !== 'object') {
						selected = item;
					} else if (item.value.version) {
						return item;
					}
				}
				return selected;
			}
		}),

	// webpack
	'webpack': Joi.object({
		'type': Joi.string()
			.valid('angular', 'classic', 'vue'),

		'transpileDependencies': Joi.array()
			.items(
				Joi.string(),
				Joi.object().instance(RegExp)
			)
	})
}).meta({ tag: 'app', ns: 'http://ti.appcelerator.org' });

/**
 * ?
 */
export default class Tiapp extends Config {
	/**
	 * ?
	 */
	static Project = Symbol('project');

	/**
	 * ?
	 */
	static User = Symbol('user');

	/**
	 * ?
	 *
	 * @param {Object} [opts] - Various options.
	 * @access public
	 */
	constructor(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		const { file } = opts;
		delete opts.file;

		opts.layers = [ { id: Tiapp.User, order: 1000 } ];
		opts.schema = schema;
		// opts.stores = XMLStore;

		super(opts);

		if (file) {
			this.load(file);
		}
	}

	/**
	 * Resolves the default config layer.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.action] - The action being performed.
	 * @returns {Symbol|Array.<Symbol>}
	 * @access public
	 */
	resolve({ action, tags } = {}) {
		const dest = tags.includes('user') ? Tiapp.User : Tiapp.Project;
		return action === 'load' || action === 'save' ? dest : [ Tiapp.Runtime, dest ];
	}
}
