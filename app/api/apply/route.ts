import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { name, studentId, phone, interest, grade, department } = data;

    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        '이름': { title: [{ text: { content: name || '' } }] },
        '학번': { rich_text: [{ text: { content: studentId || '' } }] },
        '연락처': { rich_text: [{ text: { content: phone || '' } }] },
        '학년': { rich_text: [{ text: { content: grade || '' } }] },
        '학과': { rich_text: [{ text: { content: department || '' } }] },
        '관심 분야': { rich_text: [{ text: { content: interest || '' } }] },
      },
    });

    return NextResponse.json({ message: 'Success' }, { status: 200 });
  } catch (error) {
    console.error('Notion API Error:', error);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}