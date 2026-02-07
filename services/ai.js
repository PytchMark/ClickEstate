const OpenAI = require('openai');

let openai = null;

function getOpenAI() {
  if (!openai && process.env.EMERGENT_LLM_KEY) {
    openai = new OpenAI({
      apiKey: process.env.EMERGENT_LLM_KEY
    });
  }
  return openai;
}

async function generatePropertyDescription(propertyDetails) {
  const client = getOpenAI();
  if (!client) {
    return { ok: false, error: 'AI not configured - EMERGENT_LLM_KEY not set' };
  }

  const { title, property_type, bedrooms, bathrooms, sqft, lot_size, parish, community, address, features, price } = propertyDetails;

  const prompt = `You are a luxury real estate copywriter. Write a compelling, professional property listing description that sells.

Property Details:
- Title: ${title || 'Beautiful Property'}
- Type: ${property_type || 'Residential'}
- Bedrooms: ${bedrooms || 'N/A'}
- Bathrooms: ${bathrooms || 'N/A'}
- Square Feet: ${sqft || 'N/A'}
- Lot Size: ${lot_size || 'N/A'}
- Location: ${[community, parish, address].filter(Boolean).join(', ') || 'Prime Location'}
- Features: ${features || 'Modern amenities'}
- Price: ${price ? `$${Number(price).toLocaleString()}` : 'Contact for pricing'}

Requirements:
1. Write 2-3 engaging paragraphs (150-200 words total)
2. Highlight the lifestyle benefits, not just features
3. Use aspirational language that creates emotional connection
4. Mention the location's advantages
5. End with a subtle call-to-action
6. Do NOT use phrases like "Welcome to" or "This property features"
7. Be creative and paint a picture of living there

Write the description now:`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert luxury real estate copywriter who creates compelling property descriptions that convert browsers into buyers. Your writing is elegant, aspirational, and emotionally engaging.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const description = completion.choices[0]?.message?.content?.trim();
    
    if (!description) {
      return { ok: false, error: 'No description generated' };
    }

    return { ok: true, description };
    
  } catch (error) {
    console.error('[AI] Error generating description:', error.message);
    return { ok: false, error: error.message };
  }
}

async function improvePropertyDescription(currentDescription, instructions) {
  const client = getOpenAI();
  if (!client) {
    return { ok: false, error: 'AI not configured - EMERGENT_LLM_KEY not set' };
  }

  const prompt = `You are a luxury real estate copywriter. Improve this property listing description based on the given instructions.

Current Description:
${currentDescription}

Instructions for improvement:
${instructions || 'Make it more compelling and add more lifestyle-focused language'}

Write the improved description (keep similar length, 150-200 words):`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert luxury real estate copywriter. Improve descriptions to be more compelling while maintaining accuracy.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const description = completion.choices[0]?.message?.content?.trim();
    
    if (!description) {
      return { ok: false, error: 'No description generated' };
    }

    return { ok: true, description };
    
  } catch (error) {
    console.error('[AI] Error improving description:', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = { generatePropertyDescription, improvePropertyDescription };
