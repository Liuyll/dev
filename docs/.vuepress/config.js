const path = require('path')
const generateSidebar = require('../../tools/generateSidebar')
generateSidebar(path.join(__dirname,'..'),'',true)

module.exports = {
    themeConfig: {
        sidebar: require("../sidebar"),
        nav: [
            {
                text: '首页',
                link: '/'
            },
            {
                text: '开发',
                link: '/develop/'
            }
        ]
    },
    markdown: {
        lineNumbers: true
    },
    repo: 'vuejs/vuepress',
    repoLabel: '关注github',
    title: "Liuyl Develop Log"
}

