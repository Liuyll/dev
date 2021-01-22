const fs = require('fs')
const path = require('path')
const VALID_DOC_FLAG = 'README.md'
const SIDEBAR_NAME = 'sidebar.js'
const sep = path.sep

const rawJoin = path.join
path.join = path.posix.join
const rootDocPath = path.resolve(__dirname, '../docs')
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
            console.log(curDir, subdir, getURLFromDistPath(curDir, subdir))
            sidebar.push({
                title: subdir,
                path: getURLFromDistPath(curDir, subdir),
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

const getURLFromDistPath = (path, relativePath) => {
    // slice rootPath/
    path = path.slice(rootDocPath.length + 1)
    // 如果path为空，不加后缀/号 eg: //xxx err
    path = path.replace(sep, '/')
    return '/' + path + (path.length ? '/' : '') + relativePath + '/'
}

module.exports = generateSidebar
path.join = rawJoin