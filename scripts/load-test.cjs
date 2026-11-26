#!/usr/bin/env node
/**
 * Teste de carga — VIVASS
 * Simula 10.000 estudantes, 200.000 atividades e mede p95 do painel < 800ms.
 *
 * Uso: node scripts/load-test.js
 * Requer: API rodando em http://localhost:3333 (npm run start)
 */

const http = require('node:http')
const { performance } = require('node:perf_hooks')

const BASE_URL = process.env.LOAD_TEST_URL || 'http://localhost:3333'
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '50', 10)
const DURATION_MS = parseInt(process.env.DURATION_MS || '60000', 10) // 60s
const TARGET_P95_MS = 800

const LATENCIES = []
let running = true
let requests = 0
let errors = 0

function percentile(arr, p) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil(p / 100 * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function makeRequest(path, token) {
  return new Promise((resolve) => {
    const start = performance.now()
    const options = {
      hostname: new URL(BASE_URL).hostname,
      port: new URL(BASE_URL).port,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        const latency = performance.now() - start
        LATENCIES.push(latency)
        requests += 1
        if (res.statusCode >= 400) errors += 1
        resolve({ status: res.statusCode, latency })
      })
    })
    req.on('error', () => {
      errors += 1
      requests += 1
      resolve({ status: 0, latency: performance.now() - start })
    })
    req.setTimeout(10000, () => {
      req.destroy()
      errors += 1
      requests += 1
      resolve({ status: 0, latency: performance.now() - start })
    })
    req.end()
  })
}

async function login(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password })
    const options = {
      hostname: new URL(BASE_URL).hostname,
      port: new URL(BASE_URL).port,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(body).accessToken) } catch { reject(new Error('JSON inválido')) }
        } else {
          reject(new Error(`Login falhou: ${res.statusCode} ${body}`))
        }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function worker(token, institutionId) {
  const paths = [
    `/api/institutions/${institutionId}/dashboard?days=90`,
    `/api/institutions/${institutionId}/dashboard?days=30`,
    `/api/institutions/${institutionId}/axes`,
    `/api/institutions/${institutionId}/projects?page=1&pageSize=20`,
    `/api/institutions/${institutionId}/activities?page=1&pageSize=20`,
    `/api/institutions/${institutionId}/students?page=1&pageSize=20`,
  ]

  while (running) {
    const path = paths[Math.floor(Math.random() * paths.length)]
    await makeRequest(path, token)
    // pequeno delay para não saturar
    await new Promise(r => setTimeout(r, Math.random() * 100))
  }
}

async function main() {
  console.log('\n⚡ VIVASS — Teste de Carga')
  console.log('='.repeat(50))
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Concorrência: ${CONCURRENCY} workers`)
  console.log(`Duração: ${DURATION_MS / 1000}s`)
  console.log(`Meta p95: < ${TARGET_P95_MS}ms`)
  console.log('='.repeat(50))

  // 1. Login como gestor
  console.log('\n🔐 Autenticando...')
  let token
  try {
    token = await login('gestor@vivass.demo', 'Vivass@2026')
    console.log('✅ Login OK')
  } catch (error) {
    console.error('❌ Falha no login:', error.message)
    process.exit(1)
  }

  // 2. Descobrir institutionId do gestor
  let institutionId
  try {
    const inst = await new Promise((resolve, reject) => {
      const options = {
        hostname: new URL(BASE_URL).hostname,
        port: new URL(BASE_URL).port,
        path: '/api/institutions',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      }
      http.request(options, (res) => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => resolve(JSON.parse(data)))
      }).on('error', reject).end()
    })
    institutionId = inst[0]?.id
    if (!institutionId) throw new Error('Nenhuma instituição')
    console.log(`🏫 Instituição: ${institutionId}`)
  } catch (error) {
    console.error('❌ Falha ao buscar instituição:', error.message)
    process.exit(1)
  }

  // 3. Warm-up
  console.log('\n🔥 Warm-up (10s)...')
  await Promise.all(Array.from({ length: 10 }, () => makeRequest(`/api/institutions/${institutionId}/dashboard?days=90`, token)))

  // 4. Carga sustentada
  console.log(`\n🚀 Iniciando carga por ${DURATION_MS / 1000}s com ${CONCURRENCY} workers...`)
  const startTime = Date.now()
  const workers = Array.from({ length: CONCURRENCY }, () => worker(token, institutionId))

  // Monitor de progresso
  const monitor = setInterval(() => {
    const elapsed = Date.now() - startTime
    const rps = (requests / elapsed * 1000).toFixed(1)
    const p50 = percentile(LATENCIES, 50).toFixed(0)
    const p95 = percentile(LATENCIES, 95).toFixed(0)
    const p99 = percentile(LATENCIES, 99).toFixed(0)
    process.stdout.write(`\r  ${(elapsed / 1000).toFixed(0)}s | ${requests} req | ${rps} req/s | p50=${p50}ms p95=${p95}ms p99=${p99}ms | erros=${errors}`)
  }, 2000)

  setTimeout(() => {
    running = false
  }, DURATION_MS)

  await Promise.all(workers)
  clearInterval(monitor)

  // 5. Resultados
  const totalTime = Date.now() - startTime
  const p50 = percentile(LATENCIES, 50)
  const p95 = percentile(LATENCIES, 95)
  const p99 = percentile(LATENCIES, 99)
  const avg = LATENCIES.reduce((a, b) => a + b, 0) / LATENCIES.length

  console.log('\n\n' + '='.repeat(50))
  console.log('📊 RESULTADOS')
  console.log('='.repeat(50))
  console.log(`Tempo total:     ${(totalTime / 1000).toFixed(1)}s`)
  console.log(`Requisições:     ${requests}`)
  console.log(`Erros:           ${errors} (${((errors / requests) * 100).toFixed(2)}%)`)
  console.log(`Throughput:      ${(requests / totalTime * 1000).toFixed(1)} req/s`)
  console.log(`Latência média:  ${avg.toFixed(0)}ms`)
  console.log(`p50:             ${p50.toFixed(0)}ms`)
  console.log(`p95:             ${p95.toFixed(0)}ms ${p95 <= TARGET_P95_MS ? '✅' : '❌'}`)
  console.log(`p99:             ${p99.toFixed(0)}ms`)
  console.log(`Meta p95 < ${TARGET_P95_MS}ms: ${p95 <= TARGET_P95_MS ? 'ATINGIDA ✅' : 'NÃO ATINGIDA ❌'}`)

  // Salvar relatório
  const fs = require('node:fs')
  const report = {
    timestamp: new Date().toISOString(),
    config: { baseUrl: BASE_URL, concurrency: CONCURRENCY, durationMs: DURATION_MS, targetP95Ms: TARGET_P95_MS },
    results: {
      totalTimeMs: totalTime,
      requests,
      errors,
      throughputRps: requests / totalTime * 1000,
      latency: { avg: Math.round(avg), p50: Math.round(p50), p95: Math.round(p95), p99: Math.round(p99) },
      targetP95Met: p95 <= TARGET_P95_MS,
    },
  }
  fs.writeFileSync('load-test-report.json', JSON.stringify(report, null, 2))
  console.log('\n📄 Relatório salvo em load-test-report.json')

  if (p95 > TARGET_P95_MS) process.exitCode = 1
}

main().catch(error => {
  console.error('\n❌ Erro fatal:', error.message)
  process.exit(1)
})