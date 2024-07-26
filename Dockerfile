# Use a lightweight Ubuntu image
FROM ubuntu:20.04

# Install Essential Packages
RUN apt update && apt -y upgrade
RUN apt install -y software-properties-common
RUN add-apt-repository ppa:deadsnakes/ppa

# Update packages and install any necessary dependencies
RUN apt-get update && \
    apt-get install -y sudo git python3.10 python3.10-dev gcc

# Set environment variables to avoid prompts during package installation
RUN ln -fs /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata
RUN dpkg-reconfigure --frontend noninteractive tzdata
RUN export LANG="C.UTF-8"

# Install necessary dependencies
RUN apt-get update && \
    apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    git \
    vim \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Puppeteer dependencies including libcairo2
RUN apt-get update && \
    apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libxshmfence1 \
    libgbm1 \
    libasound2 \
    libx11-xcb1 \
    libx11-6 \
    libxext6 \
    libxfixes3 \
    libxrender1 \
    libxinerama1 \
    libgl1 \
    libegl1 \
    libcairo2 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Install Chromium
RUN apt-get update && \
apt-get install -y chromium-browser && \
rm -rf /var/lib/apt/lists/*

# Install Python and pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Install pip modules
RUN pip3 install beautifulsoup4 regex vertexai

# Set the working directory
WORKDIR /app

# Copy files from the current folder to the container
COPY . .

# installation
RUN npm install

# expose port 3000
EXPOSE 3000

# Command to run the application
CMD ["node", "./main.js"]