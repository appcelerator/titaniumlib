// istanbul ignore if
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

export { default as options } from './options';
export { getInstallPaths, locations } from './locations';
export { Project, Tiapp } from './project';
export { templates } from './templates';

import * as modules from './module';
import * as sdk from './sdk';

export {
	modules,
	sdk
};
