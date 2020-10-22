import fs from 'fs-extra';
import path from 'path';
import snooplogg from 'snooplogg';
// import TemplateEngine from 'template-kit';
import Tiapp from './tiapp';
import { expandPath } from 'appcd-path';
import { templates } from '../templates';

const { log } = snooplogg('project');
// const { highlight } = snooplogg.styles;

function INVALID_ARGUMENT(msg, code, prompt) {
	const err = new TypeError(msg);
	if (code !== undefined) {
		err.code = code;
	}
	if (prompt !== undefined) {
		err.prompt = prompt;
	}
	return err;
}

/**
 * ?
 */
export default class Project {
	/**
	 * Initializes the project instance.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.path] - The path to the project directory.
	 * @param {Object} [opts.templates] - An object mapping the template type to a list of
	 * templates objects. Each template object must contain a `name`, `desc`, `path`, and `pkg`
	 * (e.g. the `package.json` content).
	 */
	constructor(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected project options to be an object');
		}

		if (opts.path !== undefined && typeof opts.path !== 'string') {
			throw new TypeError('Expected project path to be a non-empty string');
		}

		this.path = opts.path;
		this.templates = opts.templates || templates;

		const file = this.path && expandPath(this.path, 'tiapp.xml');
		this.tiapp = new Tiapp({
			// file: fs.existsSync(file) ? file : undefined
		});
	}

	/**
	 * Creates a new Titanium project.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} [opts.cwd] - A path to override the current working directory.
	 * @param {String} opts.name - The name of the new project.
	 * @param {String} opts.template - The name, URL, or path of the template to use.
	 * @param {String} opts.workspaceDir - The directory to create the project in.
	 * @returns {Promise<String>}
	 */
	async create(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		if (!opts.name || typeof opts.name !== 'string') {
			throw INVALID_ARGUMENT('Expected project name', 'EPROJNAME', {
				message: 'What is the name of your project?',
				name: 'name',
				required: true,
				type: 'input',
				validateMessage: 'Every project needs a good name',
			});
		}

		if (!opts.template) {
			const maxlen = Object.values(this.templates).reduce((p, c) => {
				return Math.max(Object.values(c).reduce((p2, c2) => {
					return Math.max(c2.name.length, p2);
				}, 0), p);
			}, 0) + 1;

			const choices = [];
			const otherMsg = 'npm package, git repo, local archive/directory, or URL';
			let i = 0;

			for (const [ type, packages ] of Object.entries(this.templates)) {
				if (i++) {
					choices.push({ role: 'separator' });
				}
				for (const pkg of packages) {
					choices.push({
						hint: ' '.repeat(maxlen - pkg.name.length) + pkg.desc,
						name: pkg.name,
						type,
						value: pkg.path
					});
				}
			}

			choices.push(
				{ role: 'separator' },
				{
					message: 'Other',
					hint: ' '.repeat(maxlen - 5) + otherMsg,
					value: {
						prompt: {
							message: otherMsg,
							required: true,
							type: 'text'
						},
						toString: () => 'Other'
					}
				}
			);

			throw INVALID_ARGUMENT('Expected template', 'EPROJTEMPLATE', {
				choices,
				message: 'What kind of project would you like to create?',
				name: 'template',
				required: true,
				type: 'select'
			});
		}

		if (opts.workspaceDir === undefined || typeof opts.workspaceDir !== 'string') {
			throw INVALID_ARGUMENT('Expected workspace directory to be a non-empty string', 'EPROJWORKSPACEDIR', {
				initial: '.',
				message: 'Where do you want the project to be created?',
				name: 'workspaceDir',
				type: 'input'
			});
		} else if (opts.workspaceDir === '') {
			opts.workspaceDir = '.';
		}

		if (!path.isAbsolute(opts.workspaceDir)) {
			opts.workspaceDir = path.resolve(opts.cwd || process.cwd(), opts.workspaceDir);
		}

		this.path = path.resolve(opts.workspaceDir, opts.name);

		log(`Creating project in directory: ${this.path}`);

		// create from template
		// const engine = new TemplateEngine({
		//	requestOptions: options.network
		// });

		// engine.on('create', async (state, next) => {
		// 	console.log('Creating the project from the template');
		// 	await next();
		// 	console.log('Project created!');
		// });

		// await engine.run({
		// 	src: 'git@github.com:appcelerator/template-kit-test.git',
		// 	dest: '/path/to/new/project'
		// });

		return 'success!';
	}
}
