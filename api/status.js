export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    configured: Boolean(process.env.TRIPO_API_KEY),
    provider: 'Tripo AI',
  });
}
