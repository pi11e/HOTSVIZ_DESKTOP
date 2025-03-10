document.addEventListener("DOMContentLoaded", () => {
    const ctx = document.getElementById('myChart').getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['January', 'February', 'March', 'April'],
            datasets: [{
                label: 'Sales ($)',
                data: [500, 700, 400, 900],
                backgroundColor: ['red', 'blue', 'green', 'orange']
            }]
        }
    });

    document.getElementById("selectFolder").addEventListener("click", async () => {
        if (!window.electron) {
            console.error("window.electron is not available.");
            return;
        }

        const folderPath = await window.electron.selectFolder();
        document.getElementById("selectedFolder").textContent = folderPath
            ? `Selected: ${folderPath}`
            : "No folder selected";
    });
});
