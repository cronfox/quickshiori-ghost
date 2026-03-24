// QuickShiori Ghost — SHIORI entry point
// Runtime documentation: https://github.com/cronfox/quickshiori

globalThis.__shiori_load = function (dir) {
    // Called when the ghost is loaded.
    // dir is the absolute path to the ghost's SHIORI directory (same as __shiori_dir).
};

globalThis.__shiori_request = function (rawRequest) {
    // Called for every SHIORI/3.0 request from the baseware.
    // rawRequest is the raw SHIORI/3.0 request string (status line + headers, CRLF-delimited).
    // Return a complete SHIORI/3.0 response string, or null/undefined to send nothing.
};

globalThis.__shiori_unload = function () {
    // Called when the ghost is unloaded.
    // Use this to flush data, close handles, etc.
};
