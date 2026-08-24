
FROM python:3.13.2

WORKDIR /code

# Install project dependencies
COPY ./pyproject.toml /code/pyproject.toml
COPY ./README.md /code/README.md
COPY ./api /code/api

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir . \
    && pip install --no-cache-dir ".[postgres]"

WORKDIR /code/api
CMD ["fastapi", "run", "main.py", "--host", "0.0.0.0", "--port", "80"]