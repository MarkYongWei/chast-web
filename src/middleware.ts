import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const userRole = request.cookies.get('userRole')?.value;
  const path = request.nextUrl.pathname;

  // 如果用户未登录且不在登录页面，重定向到登录页面
  if (!userRole && path !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 如果用户已登录且在登录页面，重定向到首页
  if (userRole && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 如果普通员工尝试访问训练数据页面，重定向到首页
  if (userRole === 'employee' && path === '/training') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}; 