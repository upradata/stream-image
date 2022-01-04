const fs = require('fs');
const path = require('path');

const removeField = ({ context, lockfile }, field, ...pkgs) => {
    for (const { pkg, isDirectDep } of pkgs) {
        context.log(`‣ Trying to remove field "${field}" from package ${pkg}`);

        const pnpmPkgName = pkg.startsWith('@') ? pkg.replace('/', '+') : pkg;

        const getPkgJsonPaths = () => {
            if (isDirectDep)
                return [ require.resolve(path.join(pkg, 'package.json')) ];

            const pkgsKeys = Object.keys(lockfile.packages).filter(p => p.split('/')[ 1 ] === pnpmPkgName);

            return pkgsKeys.map(key => {
                const [ , name, version ] = key.split('/');
                return path.join(__dirname, './node_modules/.pnpm', version ? `${name}@${version}` : name, `node_modules/${name}/package.json`);
            });
        };

        for (const pkgJsonPath of getPkgJsonPaths()) {
            const relativePkgJsonpath = path.relative(__dirname, pkgJsonPath);

            if (fs.existsSync(pkgJsonPath)) {
                const pkgJson = require(pkgJsonPath);
                delete pkgJson[ field ];

                fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), { encoding: 'utf-8' });
                context.log(`‣ ${relativePkgJsonpath} "${field}" field REMOVED !`);
            } else {
                context.log(`‣ ${pkgJsonPath} does not exist! Cannot remove field "${field}"`);
            }
        }
    }
};

function afterAllResolved(lockfile, context) {
    // type: "module" is set in canvg, but it is a CommonJs package !!
    removeField({ lockfile, context }, 'type', { pkg: 'canvg', isDirectDep: false });

    return lockfile;
}


function readPackage(pkg, context) {
    return pkg;
}


module.exports = {
    hooks: {
        // readPackage,
        afterAllResolved
    }
};
