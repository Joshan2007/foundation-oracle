import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, image, rarity, type, stats, attributes } = body;

    if (!name || !image) {
      return NextResponse.json(
        { error: 'Name and image URL are required for IPFS metadata pinning.' },
        { status: 400 }
      );
    }

    // Construct ERC-721 Standard Metadata
    const metadata = {
      name,
      description: description || 'Foundation Oracle Custom Relic',
      image,
      rarity: rarity || 'Rare',
      type: type || 'RELIC',
      stats: stats || { energy: 70, stability: 70, signal: 70 },
      attributes: attributes || [
        { trait_type: 'Rarity', value: rarity || 'Rare' },
        { trait_type: 'Category', value: type || 'RELIC' },
        { trait_type: 'Energy', value: stats?.energy || 70 },
        { trait_type: 'Stability', value: stats?.stability || 70 },
        { trait_type: 'Signal', value: stats?.signal || 70 },
      ],
      created_at: new Date().toISOString(),
      compiler: 'FOUNDATION ORACLE Relic Forge Studio v1.0',
    };

    // Generate deterministic hash string simulating IPFS Pinata pinning
    const str = JSON.stringify(metadata);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const mockCid = `QmMythic${Math.abs(hash).toString(16).padStart(12, '0')}${Date.now().toString(36)}`;
    const ipfsUri = `ipfs://${mockCid}`;
    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${mockCid}`;

    return NextResponse.json({
      success: true,
      ipfsHash: mockCid,
      ipfsUri,
      gatewayUrl,
      metadata,
    });
  } catch (error: any) {
    console.error('IPFS Pinning Error:', error);
    return NextResponse.json(
      { error: 'Failed to pin metadata to IPFS' },
      { status: 500 }
    );
  }
}
