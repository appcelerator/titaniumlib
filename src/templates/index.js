import fs from 'fs-extra';
import path from 'path';
import snooplogg from 'snooplogg';
import { isFile } from 'appcd-fs';

const { warn } = snooplogg('project-service');

/**
 * The built-in templates. These packages must be dependencies in the `package.json`.
 */
const templatePackages = {
	app: {
		'@titanium-sdk/template-app-alloy': {
			name: 'Alloy',
			desc: 'An MVC application framework'
		},
		'@titanium-sdk/template-app-classic': {
			name: 'Classic',
			desc: 'Good old fashioned JavaScript'
		},
		'@titanium-sdk/template-app-angular': {
			name: 'Angular',
			desc: 'Declarative application framework'
		},
		'@titanium-sdk/template-app-vue': {
			name: 'Vue.js',
			desc: 'The progressive JavaScript framework'
		}
	},
	module: {
		'@titanium-sdk/template-module-native': {
			name: 'Native Module',
			desc: 'Platform specific native modules for use with Titanium apps'
		}
	}
};

/**
 * The map of template types to bundled templates.
 * @type {Object}
 */
export const templates = {};

{
	const { root } = path.parse(path.resolve());

	for (const [ type, packages ] of Object.entries(templatePackages)) {
		if (!templates[type]) {
			templates[type] = [];
		}

		let current = __dirname;

		for (const [ name, info ] of Object.entries(packages)) {
			while (current !== root) {
				const dir = path.join(current, 'node_modules', name);
				const pkgJson = path.join(dir, 'package.json');

				if (isFile(pkgJson)) {
					try {
						const pkg = fs.readJsonSync(pkgJson);
						templates[type].push({
							...info,
							pkg,
							path: dir
						});
					} catch (err) {
						warn(`Could not load bundled template "${name}": ${err.toString()}`);
					}
					break;
				}

				current = path.dirname(current);
			}
		}
	}
}
