FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o dns-probe .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/dns-probe /usr/local/bin/dns-probe
EXPOSE 53/udp
ENTRYPOINT ["dns-probe"]
