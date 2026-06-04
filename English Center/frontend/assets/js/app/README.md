# Frontend App Architecture

Thu muc nay gom JavaScript theo vai tro thay vi de lan trong `assets/js`.

## Layers

- `core/`: ha tang dung chung nhu API client, auth/session, API-only guards va site integration.
- `features/admin/`: logic rieng cho dashboard admin.
- `features/teacher/`: logic rieng cho dashboard giao vien.
- `features/student/`: logic rieng cho dashboard hoc sinh.
- `template/`: hanh vi UI/UX cua template nhu sidebar, collapse, chart helper. Khong dat data demo tai day.

## Quy uoc

1. Template chi dung cho UI/UX: layout, animation, sidebar, collapse, chart helper.
2. Du lieu hien thi phai lay qua `core/api-client.js` va backend `/api/*`.
3. Khong them mang data demo vao HTML hoac feature scripts.
4. Feature theo role chi render state nhan tu API, neu API chua ve thi hien loading/empty state.
5. File moi nen dat trong layer phu hop va them vao `npm run check` neu la JavaScript thuc thi.
6. File template/demo cu neu khong duoc HTML nao load thi xoa, khong giu fallback demo trong product.
