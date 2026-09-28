import packageInfo from '../package.json'

/**
 * Runtime frontend version.
 * webui/package.json is the single frontend version source for a release.
 */
export const FRONTEND_VERSION = packageInfo.version
