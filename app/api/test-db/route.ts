// import { db } from "@/lib/db";
// import { NextRequest, NextResponse } from "next/server";

// export async function POST(request: NextRequest) {
//   let user = await db.user.create({
//     data: {
//       email: "sadf4@dfsf.com"
//     }
//   })

//   return NextResponse.json({ user })
// }

// export async function GET(request: NextRequest) {
//   let users = await db.user.findMany()

//   return NextResponse.json({ users })
// }

// export async function PUT(request: NextRequest) {
//   let res = await request.json()

//   if (!res) {
//     return NextResponse.json({ data: "no user" })
//   }

//   let user = await db.user.update({
//     where: {
//       id: res.id
//     },
//     data: {
//       email: "cool@kid2.com"
//     }
//   })

//   return NextResponse.json({ data: user })
// }

// export async function DELETE(request: NextRequest) {
//   let res = await request.json()

//   if (!res) {
//     return NextResponse.json({ data: "no user" })
//   }

//   let user = await db.user.delete({
//     where: {
//       id: res.id
//     }
//   })

//   return NextResponse.json({ data: user })
// }