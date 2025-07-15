import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: "Holly Studio",
    version: "1.0.0",
    description: "Holly Studio Development Environment"
  });
} 