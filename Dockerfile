# Usar a imagem oficial do Node.js (versão 18 LTS baseada no Alpine, que é super leve)
FROM node:18-alpine

# Definir o diretório de trabalho dentro do container
WORKDIR /app

# Copiar os arquivos de dependências primeiro (isso otimiza o cache do Docker)
COPY package*.json ./

# Instalar as dependências do projeto
RUN npm install

# Copiar o restante do código do seu backend para dentro do container
COPY . .

# Expor a porta que o seu servidor Node.js utiliza (conforme configurado no EasyPanel)
EXPOSE 3000

# Comando final para iniciar o servidor
CMD ["node", "server.js"]