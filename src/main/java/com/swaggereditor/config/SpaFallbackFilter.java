package com.swaggereditor.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Forwards all non-API, non-asset routes to the React SPA's index.html.
 * This makes client-side routing work when the app is served as a static bundle
 * from the same Spring Boot process (Docker / Kubernetes production setup).
 */
@Component
public class SpaFallbackFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty() && path.startsWith(contextPath)) {
            path = path.substring(contextPath.length());
        }

        if (shouldForward(path)) {
            request.getRequestDispatcher("/index.html").forward(request, response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean shouldForward(String path) {
        return !path.startsWith("/api/")
                && !path.startsWith("/assets/")
                && !path.equals("/index.html");
    }
}
