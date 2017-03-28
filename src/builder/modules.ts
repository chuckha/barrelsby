import {Options} from "../options";
import {Directory, isTypeScriptFile, Location} from "../utilities";

type Filters = {
    blacklists: RegExp[] | null;
    whitelists: RegExp[] | null;
};

// Get any typescript modules contained at any depth in the current directory.
function getModules(directory: Directory, options: Options): Location[] {
    options.logger(`Getting modules @ ${directory.path}`);
    if (directory.index) {
        // If theres an index then use that as it *should* contain descendant modules.
        options.logger(`Found existing index @ ${directory.index.path}`);
        return [directory.index];
    }
    let files: Location[] = [].concat(directory.files);
    directory.directories.forEach((childDirectory: Directory) => {
        // Recurse.
        files.push(...getModules(childDirectory, options));
    });
    // Only return files that look like TypeScript modules.
    return files.filter((file: Location) => file.name.match(isTypeScriptFile));
}

function buildFilters(options: Options): Filters {
    // Filter a set of modules down to those matching the include/exclude rules.
    function buildRegexList(patterns: string[]): RegExp[] | null {
        if (!Array.isArray(patterns)) {
            return null;
        }
        return patterns.map((pattern: string) => new RegExp(pattern));
    }
    return {
        blacklists: buildRegexList(options.exclude),
        whitelists: buildRegexList(options.include),
    };
}

function filterModules(filters: Filters, locations: Location[], options: Options): Location[] {
    let result = locations;
    if (filters.whitelists !== null) {
        result = result.filter((location: Location) => {
            return filters.whitelists.some((test: RegExp) => {
                const isMatch = !!location.path.match(test);
                if (isMatch) {
                    options.logger(`${location.path} is included by ${test}`);
                }
                return isMatch;
            });
        });
    }
    if (filters.blacklists !== null) {
        result = result.filter((location: Location) => {
            return !filters.blacklists.some((test: RegExp) => {
                const isMatch = !!location.path.match(test);
                if (isMatch) {
                    options.logger(`${location.path} is excluded by ${test}`);
                }
                return isMatch;
            });
        });
    }
    return result;
}

export function loadDirectoryModules(directory: Directory, options: Options): Location[] {
    const modules = getModules(directory, options);

    const filters = buildFilters(options);

    if (filters.blacklists || filters.whitelists) {
        return filterModules(filters, modules, options);
    } else {
        return modules;
    }
}