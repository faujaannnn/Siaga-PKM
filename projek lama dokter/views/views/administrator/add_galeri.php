<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">TAMBAH GALERI FOTO</h3>
                        </div>
                        <div class="card-body">
                            <form action="<?= site_url('Administrator/postGaleri') ?>" method="post" enctype="multipart/form-data">
                                <table class="table table-stripped">
                                    <tr>
                                        <td width="150px">Judul</td>
                                        <td><input type="text" name="judul" class="form-control" required></td>
                                    </tr>
                                    <tr>
                                        <td>File Photo</td>
                                        <td>
                                            <input type="file" name="gambar" class="form-control">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td width="150px">Tampilkan Foto</td>
                                        <td>
                                            <select name="log" class="form-control" required>
                                                <option value="">Pilihan</option>
                                                <option value="0">Ya</option>
                                                <option value="1">Tidak</option>
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colspan="2">
                                            <button type="submit" class="btn btn-info"><i class="fas fa-save"></i> Simpan</button>
                                            <a href="<?= site_url('Administrator/galeri') ?>" class="btn btn-danger" id="tblback"><i class="fas fa-reply"></i> Kembali</a>
                                        </td>
                                    </tr>
                                </table>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>