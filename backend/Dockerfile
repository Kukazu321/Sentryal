# On part d'une image officielle NVIDIA avec CUDA 11.8 (compatible ISCE3)
FROM nvidia/cuda:11.8.0-devel-ubuntu22.04

# 1. Configuration de base et outils système
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    wget \
    git \
    curl \
    bzip2 \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# 2. Installation de Miniconda (pour gérer ISCE3)
ENV CONDA_DIR=/opt/conda
RUN wget --quiet https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda.sh && \
    /bin/bash ~/miniconda.sh -b -p /opt/conda && \
    rm ~/miniconda.sh
ENV PATH=$CONDA_DIR/bin:$PATH

# 3. Installation de Node.js 18 (pour ton Backend)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# 4. Copie des fichiers de dépendances
WORKDIR /app
COPY environment.yml .
COPY package*.json .
COPY prisma ./prisma/

# 5. Installation de l'environnement ISCE3 via Conda
RUN conda env create -f environment.yml
# On configure le shell pour utiliser cet environnement par défaut
echo "source activate isce3_env" > ~/.bashrc
ENV PATH /opt/conda/envs/isce3_env/bin:$PATH

# 6. Installation des dépendances Node.js
RUN npm install
RUN npx prisma generate

# 7. Copie du reste du code source
COPY . .

# 8. Compilation du TypeScript
RUN npm run build

# 9. Variables d'environnement pour le GPU
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility

# 10. Démarrage
CMD ["npm", "start"]
