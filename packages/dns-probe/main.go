package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/miekg/dns"
)

var (
	workerURL  string
	responseIP net.IP
	httpClient = &http.Client{Timeout: 5 * time.Second}
)

func main() {
	workerURL = os.Getenv("WORKER_URL")
	if workerURL == "" {
		log.Fatal("WORKER_URL environment variable is required")
	}

	respIP := os.Getenv("RESPONSE_IP")
	if respIP == "" {
		respIP = "10.255.255.1"
	}
	responseIP = net.ParseIP(respIP)
	if responseIP == nil {
		log.Fatalf("invalid RESPONSE_IP: %s", respIP)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "53"
	}

	dns.HandleFunc("d.echo.nocoo.cloud.", handleQuery)

	server := &dns.Server{Addr: ":" + port, Net: "udp"}
	log.Printf("dns-probe listening on :%s/udp", port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func handleQuery(w dns.ResponseWriter, r *dns.Msg) {
	msg := new(dns.Msg)
	msg.SetReply(r)
	msg.Authoritative = true

	for _, q := range r.Question {
		if q.Qtype != dns.TypeA {
			continue
		}

		name := strings.ToLower(q.Name)
		token := extractToken(name)
		if token == "" {
			continue
		}

		rr := &dns.A{
			Hdr: dns.RR_Header{
				Name:   q.Name,
				Rrtype: dns.TypeA,
				Class:  dns.ClassINET,
				Ttl:    1,
			},
			A: responseIP,
		}
		msg.Answer = append(msg.Answer, rr)

		resolverIP, _, _ := net.SplitHostPort(w.RemoteAddr().String())
		go report(token, resolverIP, strings.TrimSuffix(name, "."))
	}

	w.WriteMsg(msg)
}

// extractToken parses token from "{token}.d.echo.nocoo.cloud."
func extractToken(name string) string {
	// name format: {token}.d.echo.nocoo.cloud.
	parts := strings.Split(name, ".")
	if len(parts) < 5 {
		return ""
	}
	return parts[0]
}

func report(token, ip, query string) {
	payload, _ := json.Marshal(map[string]string{
		"ip":    ip,
		"query": query,
	})

	url := fmt.Sprintf("%s/report/%s", workerURL, token)
	resp, err := httpClient.Post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		log.Printf("report failed for token=%s ip=%s: %v", token, ip, err)
		return
	}
	resp.Body.Close()
}
