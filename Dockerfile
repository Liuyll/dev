FROM node:12.13.0

RUN apt-get update && apt-get install -y nginx
RUN mkdir /app

EXPOSE 80

WORKDIR /app

COPY . /app

RUN npm install --registry=https://registry.npm.taobao.org \
    && npm run build \
    && cp -r docs/.vuepress/dist/* /var/www/html \
    && rm -rf /app

CMD ["nginx", "-g", "daemon off;"]