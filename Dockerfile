FROM python:3.12-alpine

WORKDIR /BackgroundJobs

RUN apk add --no-cache gcc bash musl-dev libffi-dev openssl-dev python3-dev cargo

COPY requirements.txt .

RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

RUN find /BackgroundJobs/scripts -type f -exec sed -i 's/\r$//' {} \; \
    && chmod +x /BackgroundJobs/scripts/*

ENV PYTHONPATH=/BackgroundJobs

EXPOSE 8000
