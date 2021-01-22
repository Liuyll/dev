const fs = require('fs')
const path = require('path')
const srcDir = path.resolve(__dirname, '../docs')

function generateNav() {
    const navs = []
    const dirs = fs.readdirSync(srcDir, {
        withFileTypes: true
    })
    dirs.forEach(dir => {
        if(dir.isDirectory()) {
            const name = dir.name
            if(fs.existsSync(path.join(srcDir, name, 'README.md'))) {
                navs.push({
                    text: dir.name,
                    link: '/' + dir.name + '/'
                })
            }
        }
    })

    // home
    navs.unshift({
        text: 'home',
        link: '/'
    })
    return navs
}

module.exports = generateNav