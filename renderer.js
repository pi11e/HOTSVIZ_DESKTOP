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

    document.getElementById("openDialog").addEventListener("click", () => {
        window.electron.openDialog();
    });

    document.getElementById("selectFolder").addEventListener("click", async () => {
        const result = await window.electron.selectFolder();
        if (result) {
            document.getElementById("selectedFolder").textContent = `Selected: ${result.folderPath}`;
            document.getElementById("fileCount").textContent = `Replay files found: ${result.fileCount}`;
        } else {
            document.getElementById("selectedFolder").textContent = "No folder selected";
            document.getElementById("fileCount").textContent = "";
        }
    });
});
