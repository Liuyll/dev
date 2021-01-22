const path = require('path')
const generateSidebar = require('../../tools/generateSidebar')
const generateNav = require('../../tools/generateNav')
generateSidebar(path.join(__dirname,'..'),'',true)

module.exports = {
    themeConfig: {
        sidebar: require("../sidebar"),
        nav: generateNav(),
        displayAllHeaders: false
    },
    markdown: {
        lineNumbers: true
    },
    repo: 'vuejs/vuepress',
    repoLabel: '关注github',
    title: "Liuyl Develop Log"
}

