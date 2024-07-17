FROM nginx:1.27.0-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY ./src /usr/share/nginx/html

EXPOSE 80