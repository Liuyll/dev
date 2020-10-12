const fs = require('fs')
const path = require('path')
const VALID_DOC_FLAG = 'README.md'
const SIDEBAR_NAME = 'sidebar.js'
const sep = path.sep

const rawJoin = path.join
path.join = path.posix.join
// convert "require()" -> require()
const handleSidebarStr = function(sidebarStr) {
    const pat = /["|'](require\(.*\))["|']/g
    return sidebarStr.replace(pat,($0,$1) => {
        return $1
    })
}

const joinPath = function(pathA,pathB) {
    return path.join(pathA,pathB)
}

// joinRouter need't compat between unix and windows.
const joinRouter = function(root,cur) {
    return root + '/' + cur
}
const generateSidebar = function (curDir,root = '',debug = false) {
    const sidebar = []
    const subDirs = fs.readdirSync(curDir) 
    subDirs.forEach(subdir => {
        const subdirPath = joinPath(curDir,subdir)
        if(isValidDoc(subdirPath)) {
            generateSidebar(subdirPath,joinRouter(root,subdir))
            sidebar.push({
                title: subdir,
                children: `require('.${sep}${path.join(subdir,SIDEBAR_NAME)}')`
            })
        } else if(subdir.endsWith('md') && subdir !== 'README.md') sidebar.push([joinRouter(root,subdir),subdir])
    })

    const exportStr = `
module.exports = ${handleSidebarStr(JSON.stringify(sidebar,null,2))}
    `
    fs.writeFileSync(joinPath(curDir,SIDEBAR_NAME),exportStr,'utf-8','w+')
    if(debug) return JSON.stringify(sidebar,null,2)
}

const isValidDoc = function (docPath) {
    if(!fs.statSync(docPath).isDirectory()) return false
    const files = fs.readdirSync(docPath)

    return files.some(file => file === VALID_DOC_FLAG) 
}

module.exports = generateSidebar
path.join = rawJoin