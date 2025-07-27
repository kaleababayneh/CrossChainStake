import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import relayerRoutes from './routes/injectiveRelayer.js'
import resolverRoutes from './routes/injectiveResolver.js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '../.env' })

const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

// Routes
app.use('/relayer', relayerRoutes)
app.use('/resolver', resolverRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack)
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  })
})

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`)
  console.log(`Health check available at http://localhost:${port}/health`)
}) 