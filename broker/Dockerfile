# syntax=docker/dockerfile:1

# --- build stage ---
FROM golang:1.25-alpine AS build
WORKDIR /src

# Cache module downloads.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Static, CGO-disabled binary.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/broker .

# --- runtime stage ---
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build /out/broker /broker

USER nonroot:nonroot
EXPOSE 8090
ENTRYPOINT ["/broker"]
